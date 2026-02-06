/**
 * OpponentScout - Shows opponent's roster for scouting
 * Shows defense when you're viewing offense, offense when viewing defense
 * Includes a slider to browse opponent's saved presets
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
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
  { id: 'qb_card_id', label: 'QB', position: 'QB' },
];

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
  
  const slots = showSide === 'defense' ? DEFENSE_SLOTS : OFFENSE_SLOTS;
  const isOffense = showSide === 'offense';
  const colors = isOffense ? OFFENSE_COLORS : DEFENSE_COLORS;
  
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
    return opponentRoster?.cards || {};
  }, [selectedPresetIndex, presets, opponentRoster]);

  // Detect strategy
  const opponentStrategy = useMemo(() => {
    if (!displayCards) return null;
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
  }, [isOffense]);

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

  // Find which preset index matches current roster (for highlighting)
  const currentPresetIndex = useMemo(() => {
    if (selectedPresetIndex !== null) return selectedPresetIndex;
    // Could match against actual roster here if needed
    return null;
  }, [selectedPresetIndex]);

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
        {opponentStrategy && (
          <div 
            className="px-3 py-1.5 rounded-lg text-sm font-bold"
            style={{ 
              backgroundColor: `${strategyColor}20`,
              border: `1px solid ${strategyColor}50`,
              color: strategyColor,
              fontFamily: 'var(--f10-display-font)'
            }}
          >
            {strategyLabel}
          </div>
        )}
      </div>

      {/* Opponent Slider - shows their saved presets */}
      {presets.length > 0 && (
        <div className="flex justify-center mb-3">
          <div 
            className="relative w-64 h-8 rounded-full"
            style={{ 
              background: 'linear-gradient(90deg, rgba(74,222,128,0.15) 0%, rgba(163,163,163,0.15) 50%, rgba(96,165,250,0.15) 100%)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            {/* Zone boundaries */}
            <div 
              className="absolute top-0 bottom-0 w-px bg-white/20" 
              style={{ left: `${BOUNDARY_FIRST}%` }} 
            />
            <div 
              className="absolute top-0 bottom-0 w-px bg-white/20" 
              style={{ left: `${BOUNDARY_SECOND}%` }} 
            />
            
            {/* Preset dots */}
            {presets.map((preset, idx) => {
              const pos = dotPositions[idx];
              const color = colors[preset.strategy] || '#a3a3a3';
              const isSelected = currentPresetIndex === idx;
              
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedPresetIndex(idx === selectedPresetIndex ? null : idx)}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-all duration-200"
                  style={{
                    left: `${pos}%`,
                    width: isSelected ? 20 : 14,
                    height: isSelected ? 20 : 14,
                    backgroundColor: color,
                    boxShadow: isSelected ? `0 0 12px ${color}` : `0 0 6px ${color}80`,
                    border: isSelected ? '2px solid white' : 'none',
                  }}
                  title={`${preset.name || STRATEGY_LABELS[preset.strategy] || preset.strategy}`}
                />
              );
            })}
          </div>
        </div>
      )}
      
      {selectedPresetIndex !== null && presets[selectedPresetIndex] && (
        <div className="text-center text-xs text-gray-400 mb-2" style={{ fontFamily: 'var(--f10-display-font)' }}>
          Viewing: {presets[selectedPresetIndex].name || 'Preset'}
          <button 
            onClick={() => setSelectedPresetIndex(null)}
            className="ml-2 text-red-400 hover:text-red-300"
          >
            (reset)
          </button>
        </div>
      )}

      {/* Opponent Cards - arranged in a row */}
      <div className="flex justify-center gap-2 mb-2 flex-wrap">
        {slots.map((slot) => {
          const card = displayCards[slot.id] || null;
          return (
            <div key={slot.id} className="flex flex-col items-center">
              <div 
                className="w-14 h-[4.2rem] opacity-80"
                style={{ filter: 'saturate(0.7)' }}
              >
                <MiniCard
                  card={card}
                  position={slot.label}
                  empty={!card}
                  fieldSize
                />
              </div>
            </div>
          );
        })}
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
