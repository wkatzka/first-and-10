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
// Natural "even" ratio is 1.5 (3 pass positions / 2 run positions)
const OFFENSE_THRESHOLDS = {
  runToBalanced: 1.20,  // Below this = run_heavy
  balancedToPass: 1.80, // Above this = pass_heavy
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
    
    console.log(`[Slider] Loading presets for side=${side}`);
    getRosterPresets(side)
      .then(data => {
        console.log(`[Slider] Presets response:`, data);
        if (!cancelled && data?.presets) {
          console.log(`[Slider] Loaded ${data.presets.length} ${side} presets`);
          if (data.presets.length > 0) {
            console.log(`[Slider] First preset:`, data.presets[0]);
            console.log(`[Slider] Last preset:`, data.presets[data.presets.length - 1]);
          }
          setPresets(data.presets);
        }
      })
      .catch(err => {
        console.error('[Slider] Failed to load presets:', err);
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

  // FIXED: Always use even thirds for boundaries (33.33% and 66.66%)
  // This ensures visual clarity regardless of the ratio distribution
  const BOUNDARY_FIRST = 33.33;
  const BOUNDARY_SECOND = 66.66;
  
  const boundaries = { first: BOUNDARY_FIRST, second: BOUNDARY_SECOND };

  // Position dot within its strategy zone (left third, middle third, or right third)
  // Dots are spread within their zone based on their relative position among same-strategy presets
  const getPositionInZone = useCallback((preset, allPresets) => {
    const strategy = preset.strategy;
    const leftStrategies = side === 'offense' ? ['run_heavy'] : ['run_stuff'];
    const centerStrategies = side === 'offense' ? ['balanced'] : ['base_defense'];
    const rightStrategies = side === 'offense' ? ['pass_heavy'] : ['coverage_shell'];
    
    // Determine which zone this preset belongs to
    let zoneStart, zoneEnd;
    if (leftStrategies.includes(strategy)) {
      zoneStart = 2;
      zoneEnd = BOUNDARY_FIRST - 2;
    } else if (rightStrategies.includes(strategy)) {
      zoneStart = BOUNDARY_SECOND + 2;
      zoneEnd = 98;
    } else {
      // Center zone
      zoneStart = BOUNDARY_FIRST + 2;
      zoneEnd = BOUNDARY_SECOND - 2;
    }
    
    // Find all presets in the same strategy zone
    const sameZonePresets = allPresets.filter(p => p.strategy === strategy);
    const indexInZone = sameZonePresets.findIndex(p => p.ratio === preset.ratio);
    const countInZone = sameZonePresets.length;
    
    if (countInZone === 1) {
      // Only one dot in zone - center it
      return (zoneStart + zoneEnd) / 2;
    }
    
    // Spread dots evenly within the zone
    const zoneWidth = zoneEnd - zoneStart;
    const spacing = zoneWidth / (countInZone - 1);
    return zoneStart + (indexInZone * spacing);
  }, [side]);

  // Find which preset matches current roster (by comparing ratio)
  const getCurrentPresetIndex = useCallback(() => {
    if (presets.length === 0) return -1;
    
    const currentRatio = side === 'offense' 
      ? detectedStrategy?.offenseRatio 
      : detectedStrategy?.defenseRatio;
    
    console.log(`[Slider] getCurrentPresetIndex: side=${side}, currentRatio=${currentRatio}, presets=${presets.length}`);
    
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
    console.log(`[Slider] Found closest preset idx=${closestIdx}, presetRatio=${presets[closestIdx]?.ratio}, diff=${closestDiff}`);
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
    console.log(`[Slider] handlePresetClick: index=${index}, currentIndex=${currentIndex}, disabled=${disabled}, applying=${applying}`);
    if (disabled || applying || loading || index === currentIndex) {
      console.log(`[Slider] Click skipped - conditions not met`);
      return;
    }
    
    console.log(`[Slider] Applying preset:`, presets[index]);
    setApplying(true);
    try {
      const result = await applyRosterPreset(side, presets[index].slots);
      console.log(`[Slider] applyRosterPreset result:`, result);
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
  
  // Get the current strategy for label highlighting
  const colors = side === 'offense' ? OFFENSE_COLORS : DEFENSE_COLORS;
  const currentStrategy = currentPreset?.strategy || (side === 'offense' ? 'balanced' : 'base_defense');
  
  // Determine which label should glow based on actual strategy (not position)
  const leftStrategies = side === 'offense' ? ['run_heavy'] : ['run_stuff'];
  const centerStrategies = side === 'offense' ? ['balanced'] : ['base_defense'];
  const rightStrategies = side === 'offense' ? ['pass_heavy'] : ['coverage_shell'];
  
  const isLeftActive = leftStrategies.includes(currentStrategy);
  const isCenterActive = centerStrategies.includes(currentStrategy);
  const isRightActive = rightStrategies.includes(currentStrategy);
  
  const leftColor = side === 'offense' ? OFFENSE_COLORS.run_heavy : DEFENSE_COLORS.run_stuff;
  const centerColor = side === 'offense' ? OFFENSE_COLORS.balanced : DEFENSE_COLORS.base_defense;
  const rightColor = side === 'offense' ? OFFENSE_COLORS.pass_heavy : DEFENSE_COLORS.coverage_shell;

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
      {/* Labels row - glow based on actual strategy, not position */}
      <div className="flex justify-between px-2 pt-1.5 pb-0.5 relative z-10">
        <span className="text-xs font-semibold" style={{ 
          fontFamily: "'Rajdhani', sans-serif",
          color: isLeftActive ? '#fff' : '#6b7280',
          textShadow: isLeftActive ? `0 0 8px ${leftColor}` : 'none',
        }}>
          {leftLabel}
        </span>
        <span className="text-xs font-semibold" style={{ 
          fontFamily: "'Rajdhani', sans-serif",
          color: isCenterActive ? '#fff' : '#6b7280',
          textShadow: isCenterActive ? `0 0 8px ${centerColor}` : 'none',
        }}>
          {centerLabel}
        </span>
        <span className="text-xs font-semibold" style={{ 
          fontFamily: "'Rajdhani', sans-serif",
          color: isRightActive ? '#fff' : '#6b7280',
          textShadow: isRightActive ? `0 0 8px ${rightColor}` : 'none',
        }}>
          {rightLabel}
        </span>
      </div>

      {/* Track with preset dots */}
      <div className="relative h-8 mx-2 mb-1">
        {/* Gradient track background - three even zones */}
        <div 
          className="absolute top-1/2 left-0 right-0 h-1.5 rounded-full"
          style={{
            transform: 'translateY(-50%)',
            background: `linear-gradient(to right, 
              ${leftColor}40 0%, 
              ${leftColor}40 ${BOUNDARY_FIRST}%, 
              ${centerColor}40 ${BOUNDARY_FIRST}%, 
              ${centerColor}40 ${BOUNDARY_SECOND}%, 
              ${rightColor}40 ${BOUNDARY_SECOND}%, 
              ${rightColor}40 100%)`,
          }}
        />

        {/* Strategy boundary markers - always at 1/3 and 2/3 */}
        <div
          className="absolute top-1/2 w-0.5 h-4 rounded-full"
          style={{
            left: `${BOUNDARY_FIRST}%`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(255,255,255,0.4)',
          }}
        />
        <div
          className="absolute top-1/2 w-0.5 h-4 rounded-full"
          style={{
            left: `${BOUNDARY_SECOND}%`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(255,255,255,0.4)',
          }}
        />

        {/* Preset dots - positioned within their strategy zone */}
        {presets.map((preset, i) => {
          const pos = getPositionInZone(preset, presets);
          const isActive = i === currentIndex && !dragging;
          const dotColor = getColorForStrategy(preset.strategy);
          
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => handlePresetClick(e, i)}
              disabled={disabled || applying}
              className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-150"
              style={{
                left: `${pos}%`,
                width: isActive ? '14px' : '8px',
                height: isActive ? '14px' : '8px',
                borderRadius: '50%',
                // Active: full brightness, no border, strong glow
                // Inactive: dimmer, no border, subtle
                backgroundColor: isActive ? dotColor : `${dotColor}50`,
                border: 'none',
                boxShadow: isActive ? `0 0 12px ${dotColor}, 0 0 20px ${dotColor}80` : 'none',
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
