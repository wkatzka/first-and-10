/**
 * StrategySlider - Unified strategy control
 * User drags to select strategy (auto-fill) OR it moves automatically based on roster
 */
import { useState, useRef, useEffect } from 'react';

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

export default function StrategySlider({ 
  side = 'offense', 
  detectedStrategy, 
  onStrategySelect,
  disabled = false,
}) {
  const segments = side === 'offense' ? OFFENSE_SEGMENTS : DEFENSE_SEGMENTS;
  const currentStrategy = side === 'offense' 
    ? detectedStrategy?.offensiveStrategy 
    : detectedStrategy?.defensiveStrategy;
  
  // Find current segment index based on detected strategy
  const currentIndex = segments.findIndex(s => s.value === currentStrategy);
  const activeIndex = currentIndex >= 0 ? currentIndex : 1; // Default to middle (balanced/base)
  
  const [dragging, setDragging] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(null);
  const sliderRef = useRef(null);

  const handleSegmentClick = (segment, index) => {
    if (disabled) return;
    onStrategySelect?.(segment.value);
  };

  const getSegmentStyle = (index) => {
    const isActive = index === activeIndex;
    const isHovered = index === hoverIndex && !disabled;
    const segment = segments[index];
    
    return {
      flex: 1,
      padding: '8px 4px',
      fontSize: '12px',
      fontWeight: isActive ? '700' : '500',
      fontFamily: "'Rajdhani', sans-serif",
      color: isActive ? '#fff' : '#9ca3af',
      backgroundColor: isActive ? `${segment.color}30` : 'transparent',
      borderBottom: isActive ? `2px solid ${segment.color}` : '2px solid transparent',
      transition: 'all 0.2s ease',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      textAlign: 'center',
      whiteSpace: 'nowrap',
    };
  };

  const indicatorPosition = (activeIndex / (segments.length - 1)) * 100;

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
            onClick={() => handleSegmentClick(segment, index)}
            onMouseEnter={() => setHoverIndex(index)}
            onMouseLeave={() => setHoverIndex(null)}
            disabled={disabled}
            style={getSegmentStyle(index)}
          >
            {segment.label}
          </button>
        ))}
      </div>
      
      {/* Animated indicator line */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: `${(activeIndex * 100) / segments.length}%`,
          width: `${100 / segments.length}%`,
          height: '2px',
          backgroundColor: segments[activeIndex]?.color || '#a3a3a3',
          transition: 'left 0.3s ease, background-color 0.3s ease',
          boxShadow: `0 0 8px ${segments[activeIndex]?.color || '#a3a3a3'}`,
        }}
      />
    </div>
  );
}
