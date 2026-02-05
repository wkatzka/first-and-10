/**
 * StrategySlider - Unified strategy control with continuous positioning
 * User can drag to live-swap cards OR click segments for strategy-based auto-fill
 * Shows exact position within segments based on tier ratios
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

export default function StrategySlider({ 
  side = 'offense', 
  detectedStrategy, 
  onStrategySelect,
  onRatioChange, // New: called during drag with target ratio
  disabled = false,
}) {
  const segments = side === 'offense' ? OFFENSE_SEGMENTS : DEFENSE_SEGMENTS;
  const [dragging, setDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(null);
  const sliderRef = useRef(null);
  const lastCallTime = useRef(0);

  // Calculate continuous position from ratio
  const ratio = side === 'offense' 
    ? detectedStrategy?.offenseRatio 
    : detectedStrategy?.defenseRatio;
  
  const actualPosition = side === 'offense'
    ? offenseRatioToPosition(ratio)
    : defenseRatioToPosition(ratio);
  
  // Use drag position while dragging, otherwise actual position
  const displayPosition = dragging && dragPosition != null ? dragPosition : actualPosition;
  const activeSegmentIndex = displayPosition < 33.33 ? 0 : displayPosition > 66.67 ? 2 : 1;
  const indicatorColor = getIndicatorColor(displayPosition, segments);

  // Convert position to ratio and call the ratio change handler (throttled)
  const handleDragMove = useCallback((clientX) => {
    if (!sliderRef.current || disabled) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setDragPosition(pct);
    
    // Throttle API calls to every 250ms
    const now = Date.now();
    if (now - lastCallTime.current >= 250 && onRatioChange) {
      lastCallTime.current = now;
      const targetRatio = side === 'offense' 
        ? positionToOffenseRatio(pct)
        : positionToDefenseRatio(pct);
      onRatioChange(targetRatio);
    }
  }, [side, disabled, onRatioChange]);

  const handleDragEnd = useCallback(() => {
    if (dragPosition != null && onRatioChange) {
      // Final call with exact position
      const targetRatio = side === 'offense' 
        ? positionToOffenseRatio(dragPosition)
        : positionToDefenseRatio(dragPosition);
      onRatioChange(targetRatio);
    }
    setDragging(false);
    setDragPosition(null);
  }, [dragPosition, side, onRatioChange]);

  // Mouse events
  const handleMouseDown = (e) => {
    if (disabled) return;
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
    if (disabled) return;
    setDragging(true);
    handleDragMove(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    if (!dragging) return;
    handleDragMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Click on segment still triggers strategy-based auto-fill
  const handleSegmentClick = (segment) => {
    if (disabled || dragging) return;
    onStrategySelect?.(segment.value);
  };

  const getSegmentStyle = (index) => {
    const isActive = index === activeSegmentIndex;
    const segment = segments[index];
    
    return {
      flex: 1,
      padding: '8px 4px',
      fontSize: '12px',
      fontWeight: isActive ? '700' : '500',
      fontFamily: "'Rajdhani', sans-serif",
      color: isActive ? '#fff' : '#9ca3af',
      backgroundColor: 'transparent',
      transition: dragging ? 'none' : 'all 0.2s ease',
      cursor: disabled ? 'not-allowed' : 'grab',
      opacity: disabled ? 0.5 : 1,
      textAlign: 'center',
      whiteSpace: 'nowrap',
      borderBottom: '2px solid transparent',
      userSelect: 'none',
    };
  };

  return (
    <div 
      ref={sliderRef}
      className="relative rounded-lg overflow-hidden touch-none"
      style={{
        backgroundColor: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)',
        cursor: dragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Segment labels (clickable for strategy fill) */}
      <div className="flex" style={{ pointerEvents: dragging ? 'none' : 'auto' }}>
        {segments.map((segment, index) => (
          <button
            key={segment.value}
            onClick={() => handleSegmentClick(segment)}
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
          transition: dragging ? 'width 0.1s, height 0.1s' : 'all 0.3s ease',
          boxShadow: `0 0 ${dragging ? '12px' : '8px'} ${indicatorColor}`,
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
        }}
      />
    </div>
  );
}
