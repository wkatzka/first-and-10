/**
 * OpponentScout - Shows opponent's roster for scouting
 * Shows defense when you're viewing offense, offense when viewing defense
 * Slider matches StrategySlider exactly - full width on right side
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MiniCard } from './Card';
import { getUserPresets } from '../lib/api';
import { 
  STRATEGY_LABELS, 
  STRATEGY_COLORS, 
  detectDefensiveStrategy, 
  detectOffensiveStrategy 
} from '../lib/strategyDetection';

const DEFENSE_SLOTS = [
  { id: 'db1_card_id', label: 'DB1', position: 'DB' },
  { id: 'dl_card_id', label: 'DL', position: 'DL' },
  { id: 'lb_card_id', label: 'LB', position: 'LB' },
  { id: 'db2_card_id', label: 'DB2', position: 'DB' },
];

const OFFENSE_SLOTS = [
  { id: 'wr1_card_id', label: 'WR1', position: 'WR' },
  { id: 'te_card_id', label: 'TE', position: 'TE' },
  { id: 'ol_card_id', label: 'OL', position: 'OL' },
  { id: 'rb_card_id', label: 'RB', position: 'RB' },
  { id: 'wr2_card_id', label: 'WR2', position: 'WR' },
];

const QB_SLOT = { id: 'qb_card_id', label: 'QB', position: 'QB' };

// Tier caps (same as user's)
const OFFENSE_TIER_CAP = 42;
const DEFENSE_TIER_CAP = 28;

// Slider colors - match StrategySlider exactly
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

// Calculate tier sum from cards
function calculateTierSum(cards, slots) {
  if (!cards) return 0;
  let sum = 0;
  for (const slot of slots) {
    const card = cards[slot.id];
    if (card?.tier) sum += card.tier;
  }
  return sum;
}

export default function OpponentScout({ 
  opponentRoster, 
  opponentName, 
  opponentId,
  loading, 
  showSide = 'defense' 
}) {
  const [presets, setPresets] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(null);
  const sliderRef = useRef(null);
  
  const isOffense = showSide === 'offense';
  const colors = isOffense ? OFFENSE_COLORS : DEFENSE_COLORS;
  const tierCap = isOffense ? OFFENSE_TIER_CAP : DEFENSE_TIER_CAP;
  const sideLabel = isOffense ? 'Offense' : 'Defense';
  
  // Fix: Access cards from the correct path in the data structure
  const rosterCards = opponentRoster?.roster?.cards || opponentRoster?.cards || {};
  
  // Fetch opponent's presets when opponentId or side changes
  useEffect(() => {
    if (!opponentId) {
      return;
    }
    
    setLoadingPresets(true);
    setCurrentIndex(0);
    
    getUserPresets(opponentId, showSide)
      .then(data => {
        if (data?.presets && data.presets.length > 0) {
          setPresets(data.presets);
          const midIndex = Math.floor(data.presets.length / 2);
          setCurrentIndex(midIndex);
        } else {
          setPresets([]);
        }
      })
      .catch(err => {
        console.error('[OpponentScout] Failed to load opponent presets:', err);
        setPresets([]);
      })
      .finally(() => {
        setLoadingPresets(false);
      });
  }, [opponentId, showSide]);

  // Get current preset
  const currentPreset = presets[currentIndex] || null;

  // Get current cards to display
  const displayCards = useMemo(() => {
    if (currentPreset) {
      return currentPreset.slots || {};
    }
    return rosterCards;
  }, [currentPreset, rosterCards]);

  // Calculate tier sum for displayed cards
  const tierSum = useMemo(() => {
    const slots = isOffense ? [...OFFENSE_SLOTS, QB_SLOT] : DEFENSE_SLOTS;
    return calculateTierSum(displayCards, slots);
  }, [displayCards, isOffense]);

  // Detect strategy from displayed cards
  const opponentStrategy = useMemo(() => {
    if (currentPreset) {
      return currentPreset.strategy;
    }
    if (!displayCards || Object.keys(displayCards).length === 0) return null;
    return isOffense 
      ? detectOffensiveStrategy(displayCards)
      : detectDefensiveStrategy(displayCards);
  }, [currentPreset, displayCards, isOffense]);

  // Strategy zone helpers
  const leftStrategies = isOffense ? ['run_heavy'] : ['run_stuff'];
  const rightStrategies = isOffense ? ['pass_heavy'] : ['coverage_shell'];

  const getZoneBounds = useCallback((strategy) => {
    if (leftStrategies.includes(strategy)) {
      return { start: ZONE_PAD, end: BOUNDARY_FIRST - ZONE_PAD };
    }
    if (rightStrategies.includes(strategy)) {
      return { start: BOUNDARY_SECOND + ZONE_PAD, end: 100 - ZONE_PAD };
    }
    return { start: BOUNDARY_FIRST + ZONE_PAD, end: BOUNDARY_SECOND - ZONE_PAD };
  }, [leftStrategies, rightStrategies]);

  // Pre-compute visual positions for all dots
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

  // Find nearest dot by visual position
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

  const getColorForStrategy = (strategy) => {
    return colors[strategy] || '#a3a3a3';
  };

  // Get position % from clientX
  const getPositionFromClient = useCallback((clientX) => {
    if (!sliderRef.current) return null;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(100, (x / rect.width) * 100));
  }, []);

  // Apply preset by index
  const selectPreset = useCallback((index) => {
    if (index < 0 || index >= presets.length) return;
    setCurrentIndex(index);
  }, [presets]);

  // Pointer handlers
  const handlePointerDown = useCallback((clientX) => {
    if (loadingPresets || presets.length === 0) return;
    const pct = getPositionFromClient(clientX);
    if (pct == null) return;
    setDragging(true);
    setDragPosition(pct);
  }, [loadingPresets, presets.length, getPositionFromClient]);

  const handlePointerMove = useCallback((clientX) => {
    if (!dragging) return;
    const pct = getPositionFromClient(clientX);
    if (pct != null) setDragPosition(pct);
  }, [dragging, getPositionFromClient]);

  const handlePointerUp = useCallback(() => {
    if (!dragging) return;
    
    const finalPos = dragPosition;
    setDragging(false);
    setDragPosition(null);
    
    if (finalPos == null) return;
    
    const nearestIdx = findNearestDotByPosition(finalPos);
    if (nearestIdx >= 0) {
      selectPreset(nearestIdx);
    }
  }, [dragging, dragPosition, findNearestDotByPosition, selectPreset]);

  // Mouse events
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    handlePointerDown(e.clientX);
  }, [handlePointerDown]);

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

  // Touch events
  const handleTouchStart = useCallback((e) => {
    handlePointerDown(e.touches[0].clientX);
  }, [handlePointerDown]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    handlePointerMove(e.touches[0].clientX);
  }, [handlePointerMove]);

  const handleTouchEnd = useCallback(() => {
    handlePointerUp();
  }, [handlePointerUp]);

  // Highlight nearest dot while dragging
  const dragNearestIdx = dragging && dragPosition != null 
    ? findNearestDotByPosition(dragPosition)
    : -1;

  if (loading) {
    return (
      <div className="mb-6 text-center">
        <div className="text-gray-400 text-sm">Loading opponent...</div>
      </div>
    );
  }

  if (!opponentRoster) {
    return null;
  }
  
  // Labels for slider
  const leftLabel = isOffense ? 'Run' : 'Run Stop';
  const centerLabel = isOffense ? 'Balanced' : 'Base';
  const rightLabel = isOffense ? 'Pass' : 'Coverage';
  
  const currentStrategy = currentPreset?.strategy || opponentStrategy || (isOffense ? 'balanced' : 'base_defense');
  const isLeftActive = leftStrategies.includes(currentStrategy);
  const isCenterActive = !isLeftActive && !rightStrategies.includes(currentStrategy);
  const isRightActive = rightStrategies.includes(currentStrategy);
  
  const leftColor = isOffense ? OFFENSE_COLORS.run_heavy : DEFENSE_COLORS.run_stuff;
  const centerColor = isOffense ? OFFENSE_COLORS.balanced : DEFENSE_COLORS.base_defense;
  const rightColor = isOffense ? OFFENSE_COLORS.pass_heavy : DEFENSE_COLORS.coverage_shell;

  return (
    <div className="mb-2">
      {/* Opponent Info - Tier on left, Slider on right (compact) */}
      <div className="flex items-end justify-between px-1 mb-1 relative" style={{ marginTop: '76px', zIndex: 25 }}>
        {/* Opponent Tier Info - Left side, purple styling, positioned higher */}
        <div className="flex flex-col gap-0.5" style={{ marginTop: '-23px' }}>
          <div 
            className="px-1 py-0.5 rounded text-[9px] font-bold whitespace-nowrap"
            style={{ 
              backgroundColor: 'rgba(168,85,247,0.15)',
              border: '1px solid rgba(168,85,247,0.3)',
              fontFamily: "'Rajdhani', sans-serif",
            }}
          >
            <span className="text-purple-400/70">{sideLabel} Cap = </span>
            <span className="text-purple-400">{tierCap}</span>
          </div>
          <div 
            className="px-1 py-0.5 rounded text-[9px] font-bold whitespace-nowrap"
            style={{ 
              backgroundColor: 'rgba(168,85,247,0.15)',
              border: '1px solid rgba(168,85,247,0.3)',
              fontFamily: "'Rajdhani', sans-serif",
            }}
          >
            <span className="text-purple-400/70">{sideLabel} Sum = </span>
            <span className="text-purple-400">{tierSum}</span>
            <span className="text-purple-400/50">/{tierCap}</span>
          </div>
        </div>

        {/* Opponent Slider - Right side, compact */}
        <div 
          ref={sliderRef}
          className="relative rounded-lg overflow-hidden select-none"
          style={{
            width: '55%',
            maxWidth: '220px',
            backgroundColor: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.1)',
            cursor: presets.length > 0 ? 'pointer' : 'default',
            touchAction: 'none',
            zIndex: 30,
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Labels row - smaller */}
          <div className="flex justify-between px-1.5 pt-1 pb-0 relative z-10 pointer-events-none">
            <span className="text-[9px] font-semibold" style={{ 
              fontFamily: "'Rajdhani', sans-serif",
              color: isLeftActive ? '#fff' : '#6b7280',
              textShadow: isLeftActive ? `0 0 8px ${leftColor}` : 'none',
            }}>
              {leftLabel}
            </span>
            <span className="text-[9px] font-semibold" style={{ 
              fontFamily: "'Rajdhani', sans-serif",
              color: isCenterActive ? '#fff' : '#6b7280',
              textShadow: isCenterActive ? `0 0 8px ${centerColor}` : 'none',
            }}>
              {centerLabel}
            </span>
            <span className="text-[9px] font-semibold" style={{ 
              fontFamily: "'Rajdhani', sans-serif",
              color: isRightActive ? '#fff' : '#6b7280',
              textShadow: isRightActive ? `0 0 8px ${rightColor}` : 'none',
            }}>
              {rightLabel}
            </span>
          </div>

          {/* Track with preset dots - shorter height */}
          <div className="relative h-6 mx-1.5 mb-0.5">
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

            {/* Dots */}
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
                  boxShadow: '0 0 12px rgba(255,255,255,0.3)',
                  zIndex: 10,
                  opacity: 0.7,
                }}
              />
            )}
            
            {/* Loading/empty state */}
            {loadingPresets && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-gray-500 text-xs">Loading...</span>
              </div>
            )}
            {!loadingPresets && presets.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-gray-500 text-xs">No presets</span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Opponent Cards - Field Formation */}
      <div 
        className="relative" 
        style={{ 
          height: isOffense ? 'min(95px, 13vh)' : 'min(50px, 7vh)', 
          marginTop: '14px' 
        }}
      >
        {isOffense ? (
          <>
            {/* QB at top center */}
            <div 
              className="absolute left-1/2"
              style={{ top: '0', transform: 'translateX(-50%) scale(var(--card-scale, 1))' }}
            >
              <div className="opacity-80" style={{ filter: 'saturate(0.7)' }}>
                <MiniCard
                  card={displayCards[QB_SLOT.id]}
                  position={QB_SLOT.label}
                  empty={!displayCards[QB_SLOT.id]}
                  fieldSize
                />
              </div>
            </div>
            
            {/* Skill positions in arc below QB */}
            {OFFENSE_SLOTS.map((slot, idx) => {
              const xPositions = [0.08, 0.27, 0.5, 0.73, 0.92];
              // Use percentage-based offsets relative to container
              const yPercents = [45, 58, 68, 58, 45];
              
              return (
                <div 
                  key={slot.id}
                  className="absolute"
                  style={{ 
                    left: `${xPositions[idx] * 100}%`,
                    top: `${yPercents[idx]}%`,
                    transform: 'translateX(-50%) scale(var(--card-scale, 1))'
                  }}
                >
                  <div className="opacity-80" style={{ filter: 'saturate(0.7)' }}>
                    <MiniCard
                      card={displayCards[slot.id]}
                      position={slot.label}
                      empty={!displayCards[slot.id]}
                      fieldSize
                    />
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className="flex justify-center gap-4 sm:gap-6">
            {DEFENSE_SLOTS.map((slot, idx) => {
              const yOffsets = [0, 8, 8, 0];
              return (
                <div 
                  key={slot.id}
                  className="flex flex-col items-center"
                  style={{ marginTop: `${yOffsets[idx]}px` }}
                >
                  <div className="opacity-80" style={{ filter: 'saturate(0.7)' }}>
                    <MiniCard
                      card={displayCards[slot.id]}
                      position={slot.label}
                      empty={!displayCards[slot.id]}
                      fieldSize
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* VS Divider - positioned lower */}
      <div className="flex items-center justify-center mb-4" style={{ marginTop: '83px' }}>
        <span className="text-xs text-white font-bold" style={{ fontFamily: 'var(--f10-display-font)' }}>
          VS
        </span>
      </div>
    </div>
  );
}
