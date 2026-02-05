/**
 * StrategySlider - Unified strategy control with continuous positioning
 * User clicks to select strategy (auto-fill) OR indicator moves automatically based on roster
 * Shows exact position within segments based on tier ratios
 */
import { useState, useRef } from 'react';

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
// ratio < 0.85 = run (0-33%), 0.85-1.20 = balanced (33-67%), > 1.20 = pass (67-100%)
function offenseRatioToPosition(ratio) {
  if (ratio == null) return 50; // Default to center
  
  // Clamp to reasonable range
  const r = Math.max(0.5, Math.min(1.6, ratio));
  
  if (r <= 0.85) {
    // Run segment: 0.5 -> 0%, 0.85 -> 33%
    return ((r - 0.5) / 0.35) * 33.33;
  } else if (r <= 1.20) {
    // Balanced segment: 0.85 -> 33%, 1.20 -> 67%
    return 33.33 + ((r - 0.85) / 0.35) * 33.33;
  } else {
    // Pass segment: 1.20 -> 67%, 1.6 -> 100%
    return 66.67 + ((r - 1.20) / 0.40) * 33.33;
  }
}

// Map defense ratio to 0-100% position
// ratio < -0.8 = run_stuff (0-33%), -0.8 to 0.8 = base (33-67%), > 0.8 = coverage (67-100%)
function defenseRatioToPosition(ratio) {
  if (ratio == null) return 50; // Default to center
  
  // Clamp to reasonable range
  const r = Math.max(-3, Math.min(3, ratio));
  
  if (r <= -0.8) {
    // Run stuff segment: -3 -> 0%, -0.8 -> 33%
    return ((r + 3) / 2.2) * 33.33;
  } else if (r <= 0.8) {
    // Base segment: -0.8 -> 33%, 0.8 -> 67%
    return 33.33 + ((r + 0.8) / 1.6) * 33.33;
  } else {
    // Coverage segment: 0.8 -> 67%, 3 -> 100%
    return 66.67 + ((r - 0.8) / 2.2) * 33.33;
  }
}

// Get color based on position (gradient across segments)
function getIndicatorColor(position, segments) {
  if (position < 33.33) return segments[0].color;
  if (position > 66.67) return segments[2].color;
  return segments[1].color;
}

export default function StrategySlider({ 
  side = 'offense', 
  detectedStrategy, 
  onStrategySelect,
  disabled = false,
}) {
  const segments = side === 'offense' ? OFFENSE_SEGMENTS : DEFENSE_SEGMENTS;
  const [hoverIndex, setHoverIndex] = useState(null);
  const sliderRef = useRef(null);

  // Calculate continuous position from ratio
  const ratio = side === 'offense' 
    ? detectedStrategy?.offenseRatio 
    : detectedStrategy?.defenseRatio;
  
  const position = side === 'offense'
    ? offenseRatioToPosition(ratio)
    : defenseRatioToPosition(ratio);
  
  // Determine which segment the position falls in
  const activeSegmentIndex = position < 33.33 ? 0 : position > 66.67 ? 2 : 1;
  const indicatorColor = getIndicatorColor(position, segments);

  const handleSegmentClick = (segment) => {
    if (disabled) return;
    onStrategySelect?.(segment.value);
  };

  const getSegmentStyle = (index) => {
    const isActive = index === activeSegmentIndex;
    const isHovered = index === hoverIndex && !disabled;
    const segment = segments[index];
    
    return {
      flex: 1,
      padding: '8px 4px',
      fontSize: '12px',
      fontWeight: isActive ? '700' : '500',
      fontFamily: "'Rajdhani', sans-serif",
      color: isActive ? '#fff' : '#9ca3af',
      backgroundColor: isHovered ? `${segment.color}15` : 'transparent',
      transition: 'all 0.2s ease',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      textAlign: 'center',
      whiteSpace: 'nowrap',
      borderBottom: '2px solid transparent',
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
    >
      {/* Segment buttons */}
      <div className="flex">
        {segments.map((segment, index) => (
          <button
            key={segment.value}
            onClick={() => handleSegmentClick(segment)}
            onMouseEnter={() => setHoverIndex(index)}
            onMouseLeave={() => setHoverIndex(null)}
            disabled={disabled}
            style={getSegmentStyle(index)}
          >
            {segment.label}
          </button>
        ))}
      </div>
      
      {/* Continuous position indicator - small triangle/pip */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: `${position}%`,
          transform: 'translateX(-50%)',
          width: '12px',
          height: '4px',
          backgroundColor: indicatorColor,
          borderRadius: '2px 2px 0 0',
          transition: 'left 0.3s ease, background-color 0.3s ease',
          boxShadow: `0 0 8px ${indicatorColor}`,
        }}
      />
      
      {/* Background track showing segment boundaries */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(to right, #4ade8040 0%, #4ade8040 33.33%, #a3a3a340 33.33%, #a3a3a340 66.67%, #60a5fa40 66.67%, #60a5fa40 100%)',
        }}
      />
    </div>
  );
}
