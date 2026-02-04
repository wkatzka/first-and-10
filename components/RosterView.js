import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ChalkPlayDiagram from './ChalkPlayDiagram';
import { getRoster, getCards, updateRoster, autoFillRoster } from '../lib/api';

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

export default function RosterView({ user, diagramSide = 'offense' }) {
  const router = useRouter();
  const [roster, setRoster] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    if (!user) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

  const handleAutoFill = async () => {
    if (!confirm('Auto-fill your roster with the best available cards?')) return;

    setSaving(true);
    try {
      const newRoster = await autoFillRoster();
      setRoster(newRoster);
    } catch (err) {
      console.error('Failed to auto-fill:', err);
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

  // Calculate roster power
  const rosterPower = roster?.cards
    ? Object.values(roster.cards).reduce((sum, card) => sum + (card?.tier || 0), 0)
    : 0;
  const filledSlots = roster?.cards
    ? Object.values(roster.cards).filter(c => c).length
    : 0;

  if (!user) return null;

  return (
    <div className="space-y-6 relative">
      {/* Header – above fixed diagram */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl f10-title text-white">My Roster</h1>
          <p className="f10-subtitle">
            {filledSlots}/11 starters | Power: {rosterPower}
          </p>
        </div>

        <button
          onClick={handleAutoFill}
          disabled={saving || cards.length === 0}
          className="px-4 py-2 text-white rounded-xl transition-colors disabled:opacity-50"
          style={{ background: 'rgba(0,229,255,0.16)', border: '1px solid rgba(0,229,255,0.22)' }}
        >
          Auto-Fill Best Cards
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading roster...</div>
      ) : (
        <ChalkPlayDiagram
          mode={diagramSide}
          roster={roster}
          onSlotClick={handleSlotClick}
        />
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
                  onClick={() => router.push('/packs')}
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

