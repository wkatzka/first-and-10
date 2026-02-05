/**
 * StrategySlider - Preset-based strategy control with snap-on-release
 * Loads all achievable roster configurations and lets user drag between them
 * Snaps to the nearest preset when released
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
  const dragStartX = useRef(null);

  // Load presets when side changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    
    getRosterPresets(side)
      .then(data => {
        if (!cancelled && data?.presets) {
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

  // Calculate position (0-100) for a preset based on its index
  const getPresetPosition = useCallback((index) => {
    if (presets.length <= 1) return 50;
    return (index / (presets.length - 1)) * 100;
  }, [presets.length]);

  // Find which preset matches current roster (by comparing ratio)
  const getCurrentPresetIndex = useCallback(() => {
    if (presets.length === 0) return -1;
    
    const currentRatio = side === 'offense' 
      ? detectedStrategy?.offenseRatio 
      : detectedStrategy?.defenseRatio;
    
    if (currentRatio == null) return Math.floor(presets.length / 2);
    
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
    if (presets.length === 1) return { index: 0, preset: presets[0] };
    
    const normalizedPos = Math.max(0, Math.min(100, position));
    const idx = Math.round((normalizedPos / 100) * (presets.length - 1));
    return { index: idx, preset: presets[idx] };
  }, [presets]);

  // Current display position
  const currentIndex = getCurrentPresetIndex();
  const displayPosition = dragging && dragPosition != null 
    ? dragPosition 
    : getPresetPosition(currentIndex);

  // Get color based on position
  const getColorForPosition = (pos) => {
    const colors = side === 'offense' ? OFFENSE_COLORS : DEFENSE_COLORS;
    if (pos < 33) return colors[side === 'offense' ? 'run_heavy' : 'run_stuff'];
    if (pos > 67) return colors[side === 'offense' ? 'pass_heavy' : 'coverage_shell'];
    return colors[side === 'offense' ? 'balanced' : 'base_defense'];
  };

  const indicatorColor = getColorForPosition(displayPosition);

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
    
    if (!nearest || nearest.index === currentIndex) return;
    
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
    dragStartX.current = e.clientX;
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
    dragStartX.current = e.touches[0].clientX;
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
  const handlePresetClick = async (index) => {
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

  // Labels for the ends
  const leftLabel = side === 'offense' ? 'Run' : 'Run Stop';
  const centerLabel = side === 'offense' ? 'Balanced' : 'Base';
  const rightLabel = side === 'offense' ? 'Pass' : 'Coverage';

  if (loading) {
    return (
      <div className="relative rounded-lg overflow-hidden h-10 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <span className="text-gray-400 text-xs">Loading...</span>
      </div>
    );
  }

  if (presets.length === 0) {
    return (
      <div className="relative rounded-lg overflow-hidden h-10 flex items-center justify-center"
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
      <div className="flex justify-between px-2 pt-1.5 pb-1 relative z-10">
        <span className="text-xs font-semibold" style={{ 
          fontFamily: "'Rajdhani', sans-serif",
          color: displayPosition < 33 ? '#fff' : '#6b7280',
          textShadow: displayPosition < 33 ? `0 0 8px ${getColorForPosition(0)}` : 'none',
        }}>
          {leftLabel}
        </span>
        <span className="text-xs font-semibold" style={{ 
          fontFamily: "'Rajdhani', sans-serif",
          color: displayPosition >= 33 && displayPosition <= 67 ? '#fff' : '#6b7280',
          textShadow: displayPosition >= 33 && displayPosition <= 67 ? `0 0 8px ${getColorForPosition(50)}` : 'none',
        }}>
          {centerLabel}
        </span>
        <span className="text-xs font-semibold" style={{ 
          fontFamily: "'Rajdhani', sans-serif",
          color: displayPosition > 67 ? '#fff' : '#6b7280',
          textShadow: displayPosition > 67 ? `0 0 8px ${getColorForPosition(100)}` : 'none',
        }}>
          {rightLabel}
        </span>
      </div>

      {/* Track with preset dots */}
      <div className="relative h-6 mx-2 mb-1.5">
        {/* Gradient track background */}
        <div 
          className="absolute top-1/2 left-0 right-0 h-1 rounded-full"
          style={{
            transform: 'translateY(-50%)',
            background: side === 'offense'
              ? 'linear-gradient(to right, #4ade8060 0%, #a3a3a360 50%, #60a5fa60 100%)'
              : 'linear-gradient(to right, #4ade8060 0%, #a3a3a360 50%, #60a5fa60 100%)',
          }}
        />

        {/* Preset dots */}
        {presets.map((preset, i) => {
          const pos = getPresetPosition(i);
          const isActive = i === currentIndex && !dragging;
          const color = getColorForPosition(pos);
          
          return (
            <button
              key={i}
              type="button"
              onClick={() => handlePresetClick(i)}
              disabled={disabled || applying}
              className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-150"
              style={{
                left: `${pos}%`,
                width: isActive ? '14px' : '10px',
                height: isActive ? '14px' : '10px',
                borderRadius: '50%',
                backgroundColor: isActive ? color : 'rgba(255,255,255,0.3)',
                border: `2px solid ${isActive ? color : 'rgba(255,255,255,0.5)'}`,
                boxShadow: isActive ? `0 0 10px ${color}` : 'none',
                cursor: (disabled || applying) ? 'not-allowed' : 'pointer',
                zIndex: isActive ? 3 : 2,
              }}
              title={preset.label || `Tier sum: ${preset.tierSum}`}
            />
          );
        })}

        {/* Dragging indicator (larger, follows cursor) */}
        {dragging && dragPosition != null && (
          <div
            className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: `${dragPosition}%`,
              width: '20px',
              height: '20px',
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

      {/* Info row showing current preset details */}
      <div className="text-center pb-1">
        <span className="text-[10px] text-gray-400" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
          {applying ? 'Applying...' : 
           presets[currentIndex]?.label || 
           `${presets.length} roster${presets.length !== 1 ? 's' : ''} available`}
        </span>
      </div>
    </div>
  );
}
