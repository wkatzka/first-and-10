import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ChalkPlayDiagram from './ChalkPlayDiagram';
import { getRoster, getCards, updateRoster } from '../lib/api';

// Tier cap for roster building
const TIER_CAP = 75;

// 11-player roster: QB, RB, WR×2, TE, OL, DL, LB, DB×2, K
const ROSTER_LAYOUT = [
  { section: 'Offense', slots: [
    { id: 'qb_card_id', label: 'QB', position: 'QB', required: true },
    { id: 'rb_card_id', label: 'RB', position: 'RB' },
    { id: 'wr1_card_id', label: 'WR1', position: 'WR' },
    { id: 'wr2_card_id', label: 'WR2', position: 'WR' },
    { id: 'te_card_id', label: 'TE', position: 'TE' },
    { id: 'ol_card_id', label: 'OL', position: 'OL' },
  ]},
  { section: 'Defense', slots: [
    { id: 'dl_card_id', label: 'DL', position: 'DL' },
    { id: 'lb_card_id', label: 'LB', position: 'LB' },
    { id: 'db1_card_id', label: 'DB1', position: 'DB' },
    { id: 'db2_card_id', label: 'DB2', position: 'DB' },
  ]},
  { section: 'Special Teams', slots: [
    { id: 'k_card_id', label: 'K', position: 'K' },
  ]},
];

// Calculate tier sum from roster
function calculateTierSum(rosterCards) {
  if (!rosterCards) return 0;
  let sum = 0;
  const slotIds = [
    'qb_card_id', 'rb_card_id', 'wr1_card_id', 'wr2_card_id', 'te_card_id',
    'ol_card_id', 'dl_card_id', 'lb_card_id', 'db1_card_id', 'db2_card_id', 'k_card_id'
  ];
  for (const slotId of slotIds) {
    const card = rosterCards[slotId];
    if (card?.tier) sum += card.tier;
  }
  return sum;
}

export default function RosterView({ user, diagramSide = 'offense', refreshTrigger = 0 }) {
  const router = useRouter();
  const [roster, setRoster] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showCapWarning, setShowCapWarning] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, refreshTrigger]);

  const loadData = async () => {
    try {
      const [rosterData, cardsData] = await Promise.all([
        getRoster(),
        getCards(),
      ]);
      setRoster(rosterData);
      setCards(cardsData.cards);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
  };

  const handleCardSelect = async (card) => {
    if (!selectedSlot) return;

    // Check if this would exceed the tier cap
    if (card) {
      const currentCards = roster?.cards || {};
      const currentCardInSlot = currentCards[selectedSlot.id];
      const currentTierInSlot = currentCardInSlot?.tier || 0;
      const newTierSum = calculateTierSum(currentCards) - currentTierInSlot + card.tier;
      
      if (newTierSum > TIER_CAP) {
        setShowCapWarning(true);
        return;
      }
    }

    setSaving(true);
    try {
      const newRoster = await updateRoster({
        [selectedSlot.id]: card ? card.id : null,
      });
        setRoster(newRoster);
      setSelectedSlot(null);
    } catch (err) {
      console.error('Failed to update roster:', err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Get cards for selected position
  const availableCards = selectedSlot
    ? cards.filter(c => c.position === selectedSlot.position)
    : [];

  // Get used card IDs
  const usedCardIds = new Set();
  if (roster?.roster) {
    for (const [key, value] of Object.entries(roster.roster)) {
      if (key.endsWith('_card_id') && value) usedCardIds.add(value);
    }
  }

  if (!user) return null;

  // Calculate current tier sum
  const tierSum = calculateTierSum(roster?.cards);
  const isOverCap = tierSum > TIER_CAP;

  return (
    <div className="space-y-6 relative">
      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading roster...</div>
      ) : (
        <>
          <ChalkPlayDiagram
            mode={diagramSide}
            roster={roster}
            onSlotClick={handleSlotClick}
          />
          
          {/* Tier Cap Display - positioned in endzone corners */}
          <div 
            className="fixed left-4 top-4 z-10 px-3 py-1.5 rounded-lg text-sm font-bold"
            style={{ 
              backgroundColor: 'rgba(0,0,0,0.7)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <span className="text-gray-400">Tier Cap = </span>
            <span className="text-white">{TIER_CAP}</span>
          </div>
          
          <div 
            className="fixed right-4 top-4 z-10 px-3 py-1.5 rounded-lg text-sm font-bold"
            style={{ 
              backgroundColor: 'rgba(0,0,0,0.7)',
              border: `1px solid ${isOverCap ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)'}`,
            }}
          >
            <span className="text-gray-400">Tier Sum = </span>
            <span style={{ color: isOverCap ? '#ef4444' : '#22c55e' }}>{tierSum}</span>
          </div>
        </>
      )}

      {/* Tier Cap Warning Modal */}
      {showCapWarning && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          onClick={() => setShowCapWarning(false)}
        >
          <div
            className="f10-panel p-6 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-white mb-3">Over Tier Cap</h3>
            <p className="text-gray-300 mb-4">
              Adding this player would put your roster over the tier cap of {TIER_CAP}.
            </p>
            <p className="text-gray-400 text-sm mb-6">
              Remove or swap players with lower tiers to make room.
            </p>
            <button
              onClick={() => setShowCapWarning(false)}
              className="w-full py-3 rounded-xl font-bold text-white transition-colors"
              style={{ backgroundColor: '#3b82f6' }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Card Selection Modal */}
      {selectedSlot && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedSlot(null)}
        >
          <div
            className="f10-panel p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl f10-title text-white">
                Select {selectedSlot.position} for {selectedSlot.label}
              </h3>
              <button
                onClick={() => setSelectedSlot(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Clear Slot Option */}
            {roster?.cards?.[selectedSlot.id] && (
              <button
                onClick={() => handleCardSelect(null)}
                disabled={saving}
                className="w-full mb-4 py-2 text-red-200 rounded-xl transition-colors"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)' }}
              >
                Remove Card from Slot
              </button>
            )}

            {/* Available Cards */}
            {availableCards.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                No {selectedSlot.position} cards available.
                <br />
                <button
                  onClick={() => router.push('/cards')}
                  className="mt-2 text-blue-400 hover:underline"
                >
                  Open packs to get more cards!
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {availableCards
                  .sort((a, b) => b.tier - a.tier)
                  .map(card => {
                    const isUsed = usedCardIds.has(card.id) && roster?.cards?.[selectedSlot.id]?.id !== card.id;
                    const isCurrentlySelected = roster?.cards?.[selectedSlot.id]?.id === card.id;
                    const tierColor = card.tier >= 9 ? '#EAB308' : card.tier >= 7 ? '#A855F7' : card.tier >= 5 ? '#3B82F6' : '#6B7280';

                    return (
                      <button
                        key={card.id}
                        onClick={() => !isUsed && handleCardSelect(card)}
                        disabled={isUsed || saving}
                        className={`
                          relative text-left p-3 rounded-xl transition-all
                          ${isCurrentlySelected
                            ? 'bg-green-600/30 ring-2 ring-green-500'
                            : isUsed
                              ? 'bg-gray-700/50 opacity-50 cursor-not-allowed'
                              : 'bg-gray-700 active:bg-gray-600 active:scale-95'
                          }
                        `}
                      >
                        {/* Tier indicator */}
                        <div
                          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: tierColor, color: card.tier >= 9 ? '#000' : '#fff' }}
                        >
                          {card.tier}
                        </div>

                        {/* Player info */}
                        <div className="pr-8">
                          <div className="text-white font-bold text-sm leading-tight">
                            {card.player_name || card.player}
                          </div>
                          <div className="text-gray-400 text-xs mt-1">
                            {card.season} · {card.team}
                          </div>
                          <div className="text-xs mt-2" style={{ color: tierColor }}>
                            OVR {Math.round(card.composite_score || 0)}
                          </div>
                        </div>

                        {/* Selection indicator */}
                        {isCurrentlySelected && (
                          <div className="absolute bottom-2 right-2 text-green-400 text-lg">✓</div>
                        )}
                        {isUsed && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs text-gray-400 bg-black/70 px-2 py-1 rounded">In Use</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

