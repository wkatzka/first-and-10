/**
 * StrategySlider - Preset-based strategy control with ratio-positioned dots
 * Each dot represents a unique card combination positioned by its actual ratio
 * Visual boundaries show where strategies change
 * Snaps to nearest preset on release
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { getRosterPresets, applyRosterPreset } from '../lib/api';

const OFFENSE_COLORS = {
  run_heavy: '#4ade80',
  balanced: '#a3a3a3',
  pass_heavy: '#60a5fa',
};

const DEFENSE_COLORS = {
  run_stuff: '#4ade80',
  base_defense: '#a3a3a3',
  coverage_shell: '#60a5fa',
};

// Strategy thresholds for offense (ratio = pass tiers / run tiers)
const OFFENSE_THRESHOLDS = {
  runToBalanced: 0.85,  // Below this = run_heavy
  balancedToPass: 1.20, // Above this = pass_heavy
};

// Strategy thresholds for defense (ratio = coverage tiers - run stuff tiers)
const DEFENSE_THRESHOLDS = {
  runToBalanced: -2,   // Below this = run_stuff
  balancedToCoverage: 2, // Above this = coverage_shell
};

export default function StrategySlider({ 
  side = 'offense', 
  detectedStrategy,
  onPresetApplied,
  disabled = false,
}) {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(null);
  const sliderRef = useRef(null);

  // Load presets when side changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    
    getRosterPresets(side)
      .then(data => {
        if (!cancelled && data?.presets) {
          console.log(`Loaded ${data.presets.length} ${side} presets`);
          setPresets(data.presets);
        }
      })
      .catch(err => {
        console.error('Failed to load presets:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    
    return () => { cancelled = true; };
  }, [side]);

  // Get min/max ratios from presets (for relative positioning)
  const minRatio = presets.length > 0 ? presets[0].minRatio : 0;
  const maxRatio = presets.length > 0 ? presets[0].maxRatio : 1;
  const ratioRange = maxRatio - minRatio || 1;

  // Convert ratio to position (0-100%)
  const ratioToPosition = useCallback((ratio) => {
    if (ratioRange === 0) return 50;
    return ((ratio - minRatio) / ratioRange) * 100;
  }, [minRatio, ratioRange]);

  // Convert position (0-100%) back to ratio
  const positionToRatio = useCallback((position) => {
    return minRatio + (position / 100) * ratioRange;
  }, [minRatio, ratioRange]);

  // Get boundary positions for visual markers
  const getBoundaryPositions = useCallback(() => {
    const thresholds = side === 'offense' ? OFFENSE_THRESHOLDS : DEFENSE_THRESHOLDS;
    return {
      first: ratioToPosition(thresholds.runToBalanced),
      second: ratioToPosition(side === 'offense' ? thresholds.balancedToPass : thresholds.balancedToCoverage),
    };
  }, [side, ratioToPosition]);

  // Find which preset matches current roster (by comparing ratio)
  const getCurrentPresetIndex = useCallback(() => {
    if (presets.length === 0) return -1;
    
    const currentRatio = side === 'offense' 
      ? detectedStrategy?.offenseRatio 
      : detectedStrategy?.defenseRatio;
    
    if (currentRatio == null) return -1;
    
    // Find closest preset by ratio
    let closestIdx = 0;
    let closestDiff = Infinity;
    for (let i = 0; i < presets.length; i++) {
      const diff = Math.abs(presets[i].ratio - currentRatio);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIdx = i;
      }
    }
    return closestIdx;
  }, [presets, side, detectedStrategy]);

  // Find nearest preset to a position (0-100)
  const findNearestPreset = useCallback((position) => {
    if (presets.length === 0) return null;
    
    const targetRatio = positionToRatio(position);
    
    let closestIdx = 0;
    let closestDiff = Infinity;
    for (let i = 0; i < presets.length; i++) {
      const diff = Math.abs(presets[i].ratio - targetRatio);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIdx = i;
      }
    }
    return { index: closestIdx, preset: presets[closestIdx] };
  }, [presets, positionToRatio]);

  // Current display position
  const currentIndex = getCurrentPresetIndex();
  const currentPreset = currentIndex >= 0 ? presets[currentIndex] : null;
  const displayPosition = dragging && dragPosition != null 
    ? dragPosition 
    : currentPreset ? ratioToPosition(currentPreset.ratio) : 50;

  // Get color based on strategy
  const getColorForStrategy = (strategy) => {
    const colors = side === 'offense' ? OFFENSE_COLORS : DEFENSE_COLORS;
    return colors[strategy] || colors.balanced || colors.base_defense;
  };

  const indicatorColor = currentPreset 
    ? getColorForStrategy(currentPreset.strategy)
    : '#a3a3a3';

  // Handle drag
  const handleDragMove = useCallback((clientX) => {
    if (!sliderRef.current || disabled || applying) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setDragPosition(pct);
  }, [disabled, applying]);

  const handleDragEnd = useCallback(async () => {
    if (dragPosition == null || presets.length === 0) {
      setDragging(false);
      setDragPosition(null);
      return;
    }

    const nearest = findNearestPreset(dragPosition);
    setDragging(false);
    setDragPosition(null);
    
    if (!nearest) return;
    
    // Skip if same preset
    if (nearest.index === currentIndex) return;
    
    // Apply the preset
    setApplying(true);
    try {
      await applyRosterPreset(side, nearest.preset.slots);
      onPresetApplied?.();
    } catch (err) {
      console.error('Failed to apply preset:', err);
    } finally {
      setApplying(false);
    }
  }, [dragPosition, presets, findNearestPreset, currentIndex, side, onPresetApplied]);

  // Mouse events
  const handleMouseDown = (e) => {
    if (disabled || applying || loading) return;
    e.preventDefault();
    setDragging(true);
    handleDragMove(e.clientX);
  };

  useEffect(() => {
    if (!dragging) return;
    
    const handleMouseMove = (e) => handleDragMove(e.clientX);
    const handleMouseUp = () => handleDragEnd();
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, handleDragMove, handleDragEnd]);

  // Touch events
  const handleTouchStart = (e) => {
    if (disabled || applying || loading) return;
    setDragging(true);
    handleDragMove(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    handleDragMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Click on preset dot to jump to it
  const handlePresetClick = async (e, index) => {
    e.stopPropagation();
    if (disabled || applying || loading || index === currentIndex) return;
    
    setApplying(true);
    try {
      await applyRosterPreset(side, presets[index].slots);
      onPresetApplied?.();
    } catch (err) {
      console.error('Failed to apply preset:', err);
    } finally {
      setApplying(false);
    }
  };

  // Labels
  const leftLabel = side === 'offense' ? 'Run' : 'Run Stop';
  const centerLabel = side === 'offense' ? 'Balanced' : 'Base';
  const rightLabel = side === 'offense' ? 'Pass' : 'Coverage';

  const boundaries = getBoundaryPositions();

  if (loading) {
    return (
      <div className="relative rounded-lg overflow-hidden h-12 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <span className="text-gray-400 text-xs">Loading...</span>
      </div>
    );
  }

  if (presets.length === 0) {
    return (
      <div className="relative rounded-lg overflow-hidden h-12 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <span className="text-gray-400 text-xs">Need more cards</span>
      </div>
    );
  }

  return (
    <div 
      ref={sliderRef}
      className="relative rounded-lg overflow-hidden select-none"
      style={{
        backgroundColor: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)',
        cursor: (disabled || applying) ? 'not-allowed' : 'grab',
        opacity: (disabled || applying) ? 0.6 : 1,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Labels row */}
      <div className="flex justify-between px-2 pt-1.5 pb-0.5 relative z-10">
        <span className="text-xs font-semibold" style={{ 
          fontFamily: "'Rajdhani', sans-serif",
          color: displayPosition < boundaries.first ? '#fff' : '#6b7280',
          textShadow: displayPosition < boundaries.first ? `0 0 8px ${OFFENSE_COLORS.run_heavy}` : 'none',
        }}>
          {leftLabel}
        </span>
        <span className="text-xs font-semibold" style={{ 
          fontFamily: "'Rajdhani', sans-serif",
          color: displayPosition >= boundaries.first && displayPosition <= boundaries.second ? '#fff' : '#6b7280',
          textShadow: displayPosition >= boundaries.first && displayPosition <= boundaries.second ? `0 0 8px ${OFFENSE_COLORS.balanced}` : 'none',
        }}>
          {centerLabel}
        </span>
        <span className="text-xs font-semibold" style={{ 
          fontFamily: "'Rajdhani', sans-serif",
          color: displayPosition > boundaries.second ? '#fff' : '#6b7280',
          textShadow: displayPosition > boundaries.second ? `0 0 8px ${OFFENSE_COLORS.pass_heavy}` : 'none',
        }}>
          {rightLabel}
        </span>
      </div>

      {/* Track with preset dots */}
      <div className="relative h-8 mx-2 mb-1">
        {/* Gradient track background */}
        <div 
          className="absolute top-1/2 left-0 right-0 h-1.5 rounded-full"
          style={{
            transform: 'translateY(-50%)',
            background: `linear-gradient(to right, 
              ${OFFENSE_COLORS.run_heavy}40 0%, 
              ${OFFENSE_COLORS.run_heavy}40 ${boundaries.first}%, 
              ${OFFENSE_COLORS.balanced}40 ${boundaries.first}%, 
              ${OFFENSE_COLORS.balanced}40 ${boundaries.second}%, 
              ${OFFENSE_COLORS.pass_heavy}40 ${boundaries.second}%, 
              ${OFFENSE_COLORS.pass_heavy}40 100%)`,
          }}
        />

        {/* Strategy boundary markers */}
        {boundaries.first > 0 && boundaries.first < 100 && (
          <div
            className="absolute top-1/2 w-0.5 h-4 rounded-full"
            style={{
              left: `${boundaries.first}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(255,255,255,0.3)',
            }}
          />
        )}
        {boundaries.second > 0 && boundaries.second < 100 && (
          <div
            className="absolute top-1/2 w-0.5 h-4 rounded-full"
            style={{
              left: `${boundaries.second}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(255,255,255,0.3)',
            }}
          />
        )}

        {/* Preset dots - positioned by actual ratio */}
        {presets.map((preset, i) => {
          const pos = ratioToPosition(preset.ratio);
          const isActive = i === currentIndex && !dragging;
          const color = getColorForStrategy(preset.strategy);
          
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => handlePresetClick(e, i)}
              disabled={disabled || applying}
              className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-150"
              style={{
                left: `${pos}%`,
                width: isActive ? '16px' : '8px',
                height: isActive ? '16px' : '8px',
                borderRadius: '50%',
                backgroundColor: isActive ? color : `${color}60`,
                border: isActive ? `2px solid white` : `1px solid ${color}`,
                boxShadow: isActive ? `0 0 12px ${color}` : 'none',
                cursor: (disabled || applying) ? 'not-allowed' : 'pointer',
                zIndex: isActive ? 5 : 2,
              }}
              title={`Tier sum: ${preset.tierSum}, Ratio: ${preset.ratio.toFixed(2)}`}
            />
          );
        })}

        {/* Dragging indicator (larger, follows cursor) */}
        {dragging && dragPosition != null && (
          <div
            className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: `${dragPosition}%`,
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              backgroundColor: indicatorColor,
              border: '3px solid white',
              boxShadow: `0 0 16px ${indicatorColor}, 0 2px 8px rgba(0,0,0,0.5)`,
              zIndex: 10,
              transition: 'none',
            }}
          />
        )}
      </div>

      {/* Info row */}
      <div className="text-center pb-1">
        <span className="text-[10px] text-gray-400" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
          {applying ? 'Applying...' : `${presets.length} roster${presets.length !== 1 ? 's' : ''} • Drag or tap to change`}
        </span>
      </div>
    </div>
  );
}
