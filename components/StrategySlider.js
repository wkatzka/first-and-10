/**
 * StrategySlider - Preset-based strategy control with zone-positioned dots
 * All interaction handled at track level — taps and drags find nearest dot by visual position
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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

// Fixed boundaries at even thirds
const BOUNDARY_FIRST = 33.33;
const BOUNDARY_SECOND = 66.66;
const ZONE_PAD = 3;

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
  const [startPosition, setStartPosition] = useState(null);
  const [appliedIndex, setAppliedIndex] = useState(null);
  const sliderRef = useRef(null);

  // Load presets when side changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    
    getRosterPresets(side)
      .then(data => {
        if (!cancelled && data?.presets) {
          setPresets(data.presets);
          setAppliedIndex(null);
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

  // Clear appliedIndex when detectedStrategy changes externally (manual card swap)
  // Uses a ref guard to avoid clearing during our own apply
  const isApplyingRef = useRef(false);
  useEffect(() => {
    if (!isApplyingRef.current) {
      setAppliedIndex(null);
    }
  }, [detectedStrategy]);

  // Strategy zone helpers
  const leftStrategies = side === 'offense' ? ['run_heavy'] : ['run_stuff'];
  const rightStrategies = side === 'offense' ? ['pass_heavy'] : ['coverage_shell'];

  const getZoneBounds = useCallback((strategy) => {
    if (leftStrategies.includes(strategy)) {
      return { start: ZONE_PAD, end: BOUNDARY_FIRST - ZONE_PAD };
    }
    if (rightStrategies.includes(strategy)) {
      return { start: BOUNDARY_SECOND + ZONE_PAD, end: 100 - ZONE_PAD };
    }
    return { start: BOUNDARY_FIRST + ZONE_PAD, end: BOUNDARY_SECOND - ZONE_PAD };
  }, [side]);

  // Pre-compute visual positions for all dots (memoized)
  const dotPositions = useMemo(() => {
    if (presets.length === 0) return [];

    const groups = {};
    presets.forEach((preset, i) => {
      const s = preset.strategy;
      if (!groups[s]) groups[s] = [];
      groups[s].push(i);
    });

    const positions = new Array(presets.length);
    for (const [strategy, indices] of Object.entries(groups)) {
      const { start, end } = getZoneBounds(strategy);
      const count = indices.length;
      if (count === 1) {
        positions[indices[0]] = (start + end) / 2;
      } else {
        const width = end - start;
        const spacing = width / (count - 1);
        indices.forEach((presetIdx, zoneIdx) => {
          positions[presetIdx] = start + zoneIdx * spacing;
        });
      }
    }
    return positions;
  }, [presets, getZoneBounds]);

  // Find which preset matches current roster
  // Prefer appliedIndex (set when user clicks a dot) over ratio matching
  const getCurrentPresetIndex = useCallback(() => {
    if (presets.length === 0) return -1;
    
    if (appliedIndex != null && appliedIndex >= 0 && appliedIndex < presets.length) {
      return appliedIndex;
    }
    
    const currentRatio = side === 'offense' 
      ? detectedStrategy?.offenseRatio 
      : detectedStrategy?.defenseRatio;
    
    if (currentRatio == null) return -1;
    
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
  }, [presets, side, detectedStrategy, appliedIndex]);

  // Find nearest dot by VISUAL POSITION
  const findNearestDotByPosition = useCallback((pct) => {
    if (dotPositions.length === 0) return -1;
    
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < dotPositions.length; i++) {
      const dist = Math.abs(dotPositions[i] - pct);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    return closestIdx;
  }, [dotPositions]);

  const currentIndex = getCurrentPresetIndex();
  const currentPreset = currentIndex >= 0 ? presets[currentIndex] : null;

  const getColorForStrategy = (strategy) => {
    const colors = side === 'offense' ? OFFENSE_COLORS : DEFENSE_COLORS;
    return colors[strategy] || '#a3a3a3';
  };

  // Apply a preset by index
  const applyPreset = useCallback(async (index) => {
    if (index < 0 || index >= presets.length) return;
    if (index === currentIndex) return;
    
    setApplying(true);
    setAppliedIndex(index);
    isApplyingRef.current = true;
    try {
      await applyRosterPreset(side, presets[index].slots);
      onPresetApplied?.();
      setTimeout(() => { isApplyingRef.current = false; }, 500);
    } catch (err) {
      console.error('Failed to apply preset:', err);
      setAppliedIndex(null);
      isApplyingRef.current = false;
    } finally {
      setApplying(false);
    }
  }, [presets, currentIndex, side, onPresetApplied]);

  // Get position % from clientX
  const getPositionFromClient = useCallback((clientX) => {
    if (!sliderRef.current) return null;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(100, (x / rect.width) * 100));
  }, []);

  // --- ALL interaction handled at track level ---

  const handlePointerDown = useCallback((clientX) => {
    if (disabled || applying || loading) return;
    const pct = getPositionFromClient(clientX);
    if (pct == null) return;
    setDragging(true);
    setDragPosition(pct);
    setStartPosition(pct);
  }, [disabled, applying, loading, getPositionFromClient]);

  const handlePointerMove = useCallback((clientX) => {
    if (!dragging || disabled || applying) return;
    const pct = getPositionFromClient(clientX);
    if (pct != null) setDragPosition(pct);
  }, [dragging, disabled, applying, getPositionFromClient]);

  const handlePointerUp = useCallback(async () => {
    if (!dragging) return;
    
    const finalPos = dragPosition;
    
    setDragging(false);
    setDragPosition(null);
    setStartPosition(null);
    
    if (finalPos == null) return;
    
    const nearestIdx = findNearestDotByPosition(finalPos);
    if (nearestIdx >= 0) {
      await applyPreset(nearestIdx);
    }
  }, [dragging, dragPosition, findNearestDotByPosition, applyPreset]);

  // Mouse events on track
  const handleMouseDown = (e) => {
    e.preventDefault();
    handlePointerDown(e.clientX);
  };

  useEffect(() => {
    if (!dragging) return;
    
    const onMove = (e) => handlePointerMove(e.clientX);
    const onUp = () => handlePointerUp();
    
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, handlePointerMove, handlePointerUp]);

  // Touch events on track
  const handleTouchStart = (e) => {
    handlePointerDown(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    handlePointerMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handlePointerUp();
  };

  // Labels
  const leftLabel = side === 'offense' ? 'Run' : 'Run Stop';
  const centerLabel = side === 'offense' ? 'Balanced' : 'Base';
  const rightLabel = side === 'offense' ? 'Pass' : 'Coverage';
  
  const currentStrategy = currentPreset?.strategy || (side === 'offense' ? 'balanced' : 'base_defense');
  
  const isLeftActive = leftStrategies.includes(currentStrategy);
  const isCenterActive = !isLeftActive && !rightStrategies.includes(currentStrategy);
  const isRightActive = rightStrategies.includes(currentStrategy);
  
  const leftColor = side === 'offense' ? OFFENSE_COLORS.run_heavy : DEFENSE_COLORS.run_stuff;
  const centerColor = side === 'offense' ? OFFENSE_COLORS.balanced : DEFENSE_COLORS.base_defense;
  const rightColor = side === 'offense' ? OFFENSE_COLORS.pass_heavy : DEFENSE_COLORS.coverage_shell;

  // Highlight nearest dot while dragging
  const dragNearestIdx = dragging && dragPosition != null 
    ? findNearestDotByPosition(dragPosition)
    : -1;

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
        cursor: (disabled || applying) ? 'not-allowed' : 'pointer',
        opacity: (disabled || applying) ? 0.6 : 1,
        touchAction: 'none',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Labels row */}
      <div className="flex justify-between px-2 pt-1.5 pb-0.5 relative z-10 pointer-events-none">
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
        {/* Three-zone gradient track */}
        <div 
          className="absolute top-1/2 left-0 right-0 h-1.5 rounded-full pointer-events-none"
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

        {/* Boundary markers */}
        <div className="absolute top-1/2 w-0.5 h-4 rounded-full pointer-events-none"
          style={{ left: `${BOUNDARY_FIRST}%`, transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(255,255,255,0.4)' }}
        />
        <div className="absolute top-1/2 w-0.5 h-4 rounded-full pointer-events-none"
          style={{ left: `${BOUNDARY_SECOND}%`, transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(255,255,255,0.4)' }}
        />

        {/* Dots — purely visual, no pointer events */}
        {presets.map((preset, i) => {
          const pos = dotPositions[i];
          if (pos == null) return null;

          const isActive = i === currentIndex && !dragging;
          const isDragTarget = i === dragNearestIdx;
          const isHighlighted = isActive || isDragTarget;
          const dotColor = getColorForStrategy(preset.strategy);
          
          return (
            <div
              key={i}
              className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: `${pos}%`,
                width: isHighlighted ? '14px' : '8px',
                height: isHighlighted ? '14px' : '8px',
                borderRadius: '50%',
                backgroundColor: isHighlighted ? dotColor : `${dotColor}60`,
                boxShadow: isHighlighted ? `0 0 10px ${dotColor}, 0 0 18px ${dotColor}80` : 'none',
                transition: 'width 0.15s, height 0.15s, background-color 0.15s, box-shadow 0.15s',
                zIndex: isHighlighted ? 5 : 2,
              }}
            />
          );
        })}

        {/* Dragging indicator */}
        {dragging && dragPosition != null && (
          <div
            className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: `${dragPosition}%`,
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: dragNearestIdx >= 0 
                ? getColorForStrategy(presets[dragNearestIdx].strategy) 
                : '#a3a3a3',
              border: '2px solid rgba(255,255,255,0.8)',
              boxShadow: `0 0 12px rgba(255,255,255,0.3)`,
              zIndex: 10,
              transition: 'none',
              opacity: 0.7,
            }}
          />
        )}
      </div>

    </div>
  );
}
