/**
 * StrategySlider - Unified strategy control with continuous positioning
 * Click segments to auto-fill with that strategy
 * Shows exact position within segments based on tier ratios
 * Glow effect crossfades between segments as position changes
 */
import { useState, useRef, useCallback, useEffect } from 'react';

const OFFENSE_SEGMENTS = [
  { value: 'run_heavy', label: 'Run', color: '#4ade80' },
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

// Map defense ratio to 0-100% position
function defenseRatioToPosition(ratio) {
  if (ratio == null) return 50;
  const r = Math.max(-3, Math.min(3, ratio));
  if (r <= -0.8) return ((r + 3) / 2.2) * 33.33;
  if (r <= 0.8) return 33.33 + ((r + 0.8) / 1.6) * 33.33;
  return 66.67 + ((r - 0.8) / 2.2) * 33.33;
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
  disabled = false,
}) {
  const segments = side === 'offense' ? OFFENSE_SEGMENTS : DEFENSE_SEGMENTS;
  const [loading, setLoading] = useState(false);

  // Calculate continuous position from ratio
  const ratio = side === 'offense' 
    ? detectedStrategy?.offenseRatio 
    : detectedStrategy?.defenseRatio;
  
  const displayPosition = side === 'offense'
    ? offenseRatioToPosition(ratio)
    : defenseRatioToPosition(ratio);
  
  const indicatorColor = getIndicatorColor(displayPosition, segments);

  // Click on segment triggers strategy-based auto-fill
  const handleSegmentClick = async (segment) => {
    if (disabled || loading) return;
    setLoading(true);
    try {
      await onStrategySelect?.(segment.value);
    } finally {
      setLoading(false);
    }
  };

  const getSegmentStyle = (index) => {
    const segment = segments[index];
    const glowIntensity = getSegmentGlow(displayPosition, index);
    const isActive = glowIntensity > 0.5;
    
    return {
      flex: 1,
      padding: '10px 6px',
      fontSize: '13px',
      fontWeight: isActive ? '700' : '500',
      fontFamily: "'Rajdhani', sans-serif",
      color: glowIntensity > 0.3 ? '#fff' : '#9ca3af',
      backgroundColor: `${segment.color}${Math.round(glowIntensity * 25).toString(16).padStart(2, '0')}`,
      textShadow: glowIntensity > 0.3 ? `0 0 ${8 * glowIntensity}px ${segment.color}` : 'none',
      transition: 'all 0.15s ease',
      cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
      opacity: (disabled || loading) ? 0.5 : 1,
      textAlign: 'center',
      whiteSpace: 'nowrap',
      border: 'none',
      outline: 'none',
      userSelect: 'none',
    };
  };

  return (
    <div 
      className="relative rounded-lg overflow-hidden"
      style={{
        backgroundColor: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {/* Segment buttons - clickable for strategy fill */}
      <div className="flex relative z-10">
        {segments.map((segment, index) => (
          <button
            key={segment.value}
            type="button"
            onClick={() => handleSegmentClick(segment)}
            disabled={disabled || loading}
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
          width: '12px',
          height: '4px',
          backgroundColor: indicatorColor,
          borderRadius: '2px 2px 0 0',
          transition: 'all 0.3s ease',
          boxShadow: `0 0 8px ${indicatorColor}`,
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
