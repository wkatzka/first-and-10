/**
 * OpponentScout - Shows opponent's defense for scouting
 * Displayed above user's offense on the My Team page
 */
import { useMemo } from 'react';
import { MiniCard } from './Card';
import { STRATEGY_LABELS, STRATEGY_COLORS, detectDefensiveStrategy } from '../lib/strategyDetection';

const DEFENSE_SLOTS = [
  { id: 'db1_card_id', label: 'DB1', position: 'DB' },
  { id: 'dl_card_id', label: 'DL', position: 'DL' },
  { id: 'lb_card_id', label: 'LB', position: 'LB' },
  { id: 'db2_card_id', label: 'DB2', position: 'DB' },
];

export default function OpponentScout({ opponentRoster, opponentName, loading }) {
  // Detect opponent's defensive strategy
  const opponentStrategy = useMemo(() => {
    if (!opponentRoster?.cards) return null;
    return detectDefensiveStrategy(opponentRoster.cards);
  }, [opponentRoster]);

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

  const cards = opponentRoster.cards || {};
  const strategyLabel = STRATEGY_LABELS[opponentStrategy] || 'Unknown';
  const strategyColor = STRATEGY_COLORS[opponentStrategy] || '#a3a3a3';

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
          <span className="text-red-400">🛡️ {opponentName || 'Opponent'}'s Defense</span>
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

      {/* Opponent Defense Cards - arranged in a row */}
      <div className="flex justify-center gap-2 mb-2">
        {DEFENSE_SLOTS.map((slot) => {
          const card = cards[slot.id] || null;
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
