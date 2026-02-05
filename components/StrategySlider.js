/**
 * StrategySlider - Unified strategy control with continuous positioning
 * User can drag to live-swap cards OR click segments for strategy-based auto-fill
 * Shows exact position within segments based on tier ratios
 * Glow effect crossfades between segments as position changes
 */
import { useState, useRef, useCallback, useEffect } from 'react';

const OFFENSE_SEGMENTS = [
  { value: 'run_dominant', label: 'Run', color: '#4ade80' },
  { value: 'balanced', label: 'Balanced', color: '#a3a3a3' },
  { value: 'pass_heavy', label: 'Pass', color: '#60a5fa' },
];

const DEFENSE_SEGMENTS = [
  { value: 'run_stuff', label: 'Run Stop', color: '#4ade80' },
  { value: 'base_defense', label: 'Base', color: '#a3a3a3' },
  { value: 'coverage_shell', label: 'Coverage', color: '#60a5fa' },
];

// Map offense ratio to 0-100% position
function offenseRatioToPosition(ratio) {
  if (ratio == null) return 50;
  const r = Math.max(0.5, Math.min(1.6, ratio));
  if (r <= 0.85) return ((r - 0.5) / 0.35) * 33.33;
  if (r <= 1.20) return 33.33 + ((r - 0.85) / 0.35) * 33.33;
  return 66.67 + ((r - 1.20) / 0.40) * 33.33;
}

// Map position (0-100%) back to offense ratio
function positionToOffenseRatio(position) {
  const p = Math.max(0, Math.min(100, position));
  if (p <= 33.33) return 0.5 + (p / 33.33) * 0.35;
  if (p <= 66.67) return 0.85 + ((p - 33.33) / 33.33) * 0.35;
  return 1.20 + ((p - 66.67) / 33.33) * 0.40;
}

// Map defense ratio to 0-100% position
function defenseRatioToPosition(ratio) {
  if (ratio == null) return 50;
  const r = Math.max(-3, Math.min(3, ratio));
  if (r <= -0.8) return ((r + 3) / 2.2) * 33.33;
  if (r <= 0.8) return 33.33 + ((r + 0.8) / 1.6) * 33.33;
  return 66.67 + ((r - 0.8) / 2.2) * 33.33;
}

// Map position (0-100%) back to defense ratio
function positionToDefenseRatio(position) {
  const p = Math.max(0, Math.min(100, position));
  if (p <= 33.33) return -3 + (p / 33.33) * 2.2;
  if (p <= 66.67) return -0.8 + ((p - 33.33) / 33.33) * 1.6;
  return 0.8 + ((p - 66.67) / 33.33) * 2.2;
}

function getIndicatorColor(position, segments) {
  if (position < 33.33) return segments[0].color;
  if (position > 66.67) return segments[2].color;
  return segments[1].color;
}

// Calculate glow intensity for each segment based on position (0-1)
function getSegmentGlow(position, segmentIndex) {
  // Segment centers: 0=16.67%, 1=50%, 2=83.33%
  const segmentCenters = [16.67, 50, 83.33];
  const center = segmentCenters[segmentIndex];
  const distance = Math.abs(position - center);
  // Full glow within 16.67% of center, fade to 0 at 33%
  if (distance <= 16.67) return 1;
  if (distance >= 33.33) return 0;
  return 1 - ((distance - 16.67) / 16.67);
}

export default function StrategySlider({ 
  side = 'offense', 
  detectedStrategy, 
  onStrategySelect,
  onRatioChange,
  disabled = false,
}) {
  const segments = side === 'offense' ? OFFENSE_SEGMENTS : DEFENSE_SEGMENTS;
  const [dragging, setDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(null);
  const sliderRef = useRef(null);
  const lastCallTime = useRef(0);
  const dragStartPos = useRef(null);
  const hasDragged = useRef(false);

  // Calculate continuous position from ratio
  const ratio = side === 'offense' 
    ? detectedStrategy?.offenseRatio 
    : detectedStrategy?.defenseRatio;
  
  const actualPosition = side === 'offense'
    ? offenseRatioToPosition(ratio)
    : defenseRatioToPosition(ratio);
  
  // Use drag position while dragging, otherwise actual position
  const displayPosition = dragging && dragPosition != null ? dragPosition : actualPosition;
  const indicatorColor = getIndicatorColor(displayPosition, segments);

  // Convert position to ratio and call the ratio change handler (throttled)
  const handleDragMove = useCallback((clientX) => {
    if (!sliderRef.current || disabled) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setDragPosition(pct);
    
    // Check if we've moved enough to consider it a drag (5px threshold)
    if (dragStartPos.current != null && Math.abs(clientX - dragStartPos.current) > 5) {
      hasDragged.current = true;
    }
    
    // Throttle API calls to every 100ms for responsiveness
    const now = Date.now();
    if (now - lastCallTime.current >= 100 && onRatioChange && hasDragged.current) {
      lastCallTime.current = now;
      const targetRatio = side === 'offense' 
        ? positionToOffenseRatio(pct)
        : positionToDefenseRatio(pct);
      onRatioChange(targetRatio);
    }
  }, [side, disabled, onRatioChange]);

  const handleDragEnd = useCallback(() => {
    if (hasDragged.current && dragPosition != null && onRatioChange) {
      // Final call with exact position
      const targetRatio = side === 'offense' 
        ? positionToOffenseRatio(dragPosition)
        : positionToDefenseRatio(dragPosition);
      onRatioChange(targetRatio);
    }
    setDragging(false);
    setDragPosition(null);
    dragStartPos.current = null;
    hasDragged.current = false;
  }, [dragPosition, side, onRatioChange]);

  // Mouse events on the track area (not buttons)
  const handleTrackMouseDown = (e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    dragStartPos.current = e.clientX;
    hasDragged.current = false;
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
    if (disabled) return;
    dragStartPos.current = e.touches[0].clientX;
    hasDragged.current = false;
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

  // Click on segment triggers strategy-based auto-fill
  const handleSegmentClick = (e, segment) => {
    e.stopPropagation();
    if (disabled) return;
    onStrategySelect?.(segment.value);
  };

  const getSegmentStyle = (index) => {
    const segment = segments[index];
    const glowIntensity = getSegmentGlow(displayPosition, index);
    const isActive = glowIntensity > 0.5;
    
    return {
      flex: 1,
      padding: '8px 4px',
      fontSize: '12px',
      fontWeight: isActive ? '700' : '500',
      fontFamily: "'Rajdhani', sans-serif",
      color: glowIntensity > 0.3 ? '#fff' : '#9ca3af',
      backgroundColor: `${segment.color}${Math.round(glowIntensity * 25).toString(16).padStart(2, '0')}`,
      textShadow: glowIntensity > 0.3 ? `0 0 ${8 * glowIntensity}px ${segment.color}` : 'none',
      transition: 'all 0.15s ease',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      textAlign: 'center',
      whiteSpace: 'nowrap',
      border: 'none',
      outline: 'none',
      userSelect: 'none',
    };
  };

  return (
    <div 
      ref={sliderRef}
      className="relative rounded-lg overflow-hidden"
      style={{
        backgroundColor: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Segment buttons - clickable for strategy fill */}
      <div className="flex relative z-10">
        {segments.map((segment, index) => (
          <button
            key={segment.value}
            onClick={(e) => handleSegmentClick(e, segment)}
            onMouseDown={(e) => {
              // Allow drag to start from buttons too
              if (disabled) return;
              dragStartPos.current = e.clientX;
              hasDragged.current = false;
              setDragging(true);
              handleDragMove(e.clientX);
            }}
            disabled={disabled}
            style={getSegmentStyle(index)}
          >
            {segment.label}
          </button>
        ))}
      </div>
      
      {/* Continuous position indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: `${displayPosition}%`,
          transform: 'translateX(-50%)',
          width: dragging ? '16px' : '12px',
          height: dragging ? '6px' : '4px',
          backgroundColor: indicatorColor,
          borderRadius: '2px 2px 0 0',
          transition: dragging ? 'width 0.1s, height 0.1s' : 'all 0.2s ease',
          boxShadow: `0 0 ${dragging ? '12px' : '8px'} ${indicatorColor}`,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
      
      {/* Background track */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(to right, #4ade8040 0%, #4ade8040 33.33%, #a3a3a340 33.33%, #a3a3a340 66.67%, #60a5fa40 66.67%, #60a5fa40 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
    </div>
  );
}
