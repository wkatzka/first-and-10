/**
 * OpponentScout - Shows opponent's roster for scouting
 * Shows defense when you're viewing offense, offense when viewing defense
 * Cards displayed in field formation, mirrored (facing downfield)
 * Includes a slider matching the StrategySlider format
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

// Slider colors
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

export default function OpponentScout({ 
  opponentRoster, 
  opponentName, 
  opponentId,
  loading, 
  showSide = 'defense' 
}) {
  const [presets, setPresets] = useState([]);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(null);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const sliderRef = useRef(null);
  
  const isOffense = showSide === 'offense';
  const colors = isOffense ? OFFENSE_COLORS : DEFENSE_COLORS;
  
  // Fix: Access cards from the correct path in the data structure
  const rosterCards = opponentRoster?.roster?.cards || opponentRoster?.cards || {};
  
  // Fetch opponent's presets
  useEffect(() => {
    if (!opponentId) return;
    
    setLoadingPresets(true);
    setSelectedPresetIndex(null);
    
    getUserPresets(opponentId, showSide)
      .then(data => {
        setPresets(data?.presets || []);
      })
      .catch(err => {
        console.error('Failed to load opponent presets:', err);
        setPresets([]);
      })
      .finally(() => {
        setLoadingPresets(false);
      });
  }, [opponentId, showSide]);

  // Get current cards to display (either from preset or actual roster)
  const displayCards = useMemo(() => {
    if (selectedPresetIndex !== null && presets[selectedPresetIndex]) {
      // Show the preset's cards
      return presets[selectedPresetIndex].slots || {};
    }
    // Show actual roster
    return rosterCards;
  }, [selectedPresetIndex, presets, rosterCards]);

  // Detect strategy
  const opponentStrategy = useMemo(() => {
    if (!displayCards || Object.keys(displayCards).length === 0) return null;
    return isOffense 
      ? detectOffensiveStrategy(displayCards)
      : detectDefensiveStrategy(displayCards);
  }, [displayCards, isOffense]);

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
        const step = (end - start) / (count - 1);
        indices.forEach((idx, i) => {
          positions[idx] = start + i * step;
        });
      }
    }
    return positions;
  }, [presets, getZoneBounds]);

  // Handle dot click
  const handleDotClick = (idx) => {
    setSelectedPresetIndex(idx === selectedPresetIndex ? null : idx);
  };

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

  const strategyLabel = STRATEGY_LABELS[opponentStrategy] || 'Unknown';
  const strategyColor = STRATEGY_COLORS[opponentStrategy] || '#a3a3a3';
  const icon = isOffense ? '⚔️' : '🛡️';
  const sideLabel = isOffense ? 'Offense' : 'Defense';
  
  // Labels for slider
  const leftLabel = isOffense ? 'Run' : 'Run Stop';
  const centerLabel = isOffense ? 'Balanced' : 'Base';
  const rightLabel = isOffense ? 'Pass' : 'Coverage';
  
  const currentStrategy = opponentStrategy || (isOffense ? 'balanced' : 'base_defense');
  const isLeftActive = leftStrategies.includes(currentStrategy);
  const isCenterActive = !isLeftActive && !rightStrategies.includes(currentStrategy);
  const isRightActive = rightStrategies.includes(currentStrategy);
  
  const leftColor = isOffense ? OFFENSE_COLORS.run_heavy : DEFENSE_COLORS.run_stuff;
  const centerColor = isOffense ? OFFENSE_COLORS.balanced : DEFENSE_COLORS.base_defense;
  const rightColor = isOffense ? OFFENSE_COLORS.pass_heavy : DEFENSE_COLORS.coverage_shell;

  return (
    <div className="mb-4">
      {/* Opponent Header */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <div 
          className="px-3 py-1.5 rounded-lg text-sm font-bold"
          style={{ 
            backgroundColor: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            fontFamily: 'var(--f10-display-font)'
          }}
        >
          <span className="text-red-400">{icon} {opponentName || 'Opponent'}'s {sideLabel}</span>
        </div>
      </div>

      {/* Opponent Slider - exact format as StrategySlider */}
      <div className="flex justify-center mb-3">
        <div 
          ref={sliderRef}
          className="relative rounded-lg overflow-hidden select-none w-64"
          style={{
            backgroundColor: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
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
            
            {/* Zone boundary lines */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-px h-4 bg-white/30"
              style={{ left: `${BOUNDARY_FIRST}%` }}
            />
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-px h-4 bg-white/30"
              style={{ left: `${BOUNDARY_SECOND}%` }}
            />
            
            {/* Preset dots */}
            {presets.map((preset, idx) => {
              const pos = dotPositions[idx];
              if (pos == null) return null;
              
              const color = colors[preset.strategy] || '#a3a3a3';
              const isSelected = selectedPresetIndex === idx;
              
              return (
                <button
                  key={idx}
                  onClick={() => handleDotClick(idx)}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-all duration-200 cursor-pointer hover:scale-110"
                  style={{
                    left: `${pos}%`,
                    width: isSelected ? 18 : 12,
                    height: isSelected ? 18 : 12,
                    backgroundColor: color,
                    boxShadow: isSelected ? `0 0 12px ${color}` : `0 0 6px ${color}80`,
                    border: isSelected ? '2px solid white' : '1px solid rgba(255,255,255,0.3)',
                  }}
                  title={STRATEGY_LABELS[preset.strategy] || preset.strategy}
                />
              );
            })}
            
            {/* "No presets" message */}
            {presets.length === 0 && !loadingPresets && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-gray-500 text-xs">No presets available</span>
              </div>
            )}
            
            {loadingPresets && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-gray-500 text-xs">Loading...</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {selectedPresetIndex !== null && presets[selectedPresetIndex] && (
        <div className="text-center text-xs text-gray-400 mb-2" style={{ fontFamily: 'var(--f10-display-font)' }}>
          Viewing: {STRATEGY_LABELS[presets[selectedPresetIndex].strategy] || 'Preset'}
          <button 
            onClick={() => setSelectedPresetIndex(null)}
            className="ml-2 text-red-400 hover:text-red-300"
          >
            (reset)
          </button>
        </div>
      )}

      {/* Opponent Cards - Field Formation, Mirrored (facing downfield) */}
      <div className="relative" style={{ height: isOffense ? '140px' : '80px' }}>
        {isOffense ? (
          // Offense formation - mirrored (QB at top, line below)
          <>
            {/* QB at top center */}
            <div 
              className="absolute left-1/2 -translate-x-1/2"
              style={{ top: '0px', transform: 'translateX(-50%) rotate(180deg)' }}
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
            
            {/* Skill positions in arc below QB - mirrored */}
            {OFFENSE_SLOTS.map((slot, idx) => {
              // Position calculations for upside-down U shape
              const xPositions = [0.1, 0.28, 0.5, 0.72, 0.9]; // WR1, TE, OL, RB, WR2
              const yOffsets = [75, 90, 100, 90, 75]; // Arc shape (inverted for mirror)
              
              return (
                <div 
                  key={slot.id}
                  className="absolute"
                  style={{ 
                    left: `${xPositions[idx] * 100}%`,
                    top: `${yOffsets[idx]}px`,
                    transform: 'translateX(-50%) rotate(180deg)'
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
          // Defense formation - mirrored (facing downfield)
          <div className="flex justify-center gap-4">
            {DEFENSE_SLOTS.map((slot, idx) => {
              const yOffsets = [20, 0, 0, 20]; // DB1, DL, LB, DB2 stagger
              return (
                <div 
                  key={slot.id}
                  className="flex flex-col items-center"
                  style={{ 
                    marginTop: `${yOffsets[idx]}px`,
                    transform: 'rotate(180deg)'
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
          </div>
        )}
      </div>
      
      {/* Divider */}
      <div className="flex items-center justify-center gap-2 my-3">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <span className="text-xs text-gray-500 font-medium" style={{ fontFamily: 'var(--f10-display-font)' }}>
          VS
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>
    </div>
  );
}
