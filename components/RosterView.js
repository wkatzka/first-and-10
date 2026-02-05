import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ChalkPlayDiagram from './ChalkPlayDiagram';
import CardModal from './CardModal';
import { getRoster, getCards, updateRoster, getRosterStrategy } from '../lib/api';
import {
  detectOffensiveStrategy,
  detectDefensiveStrategy,
  detectStrategyWithSwap,
  STRATEGY_LABELS,
  STRATEGY_COLORS,
} from '../lib/strategyDetection';

// Tier caps for roster building (separate for offense and defense)
const OFFENSE_TIER_CAP = 42; // 6 slots: QB, RB, WR1, WR2, TE, OL (avg ~T7)
const DEFENSE_TIER_CAP = 28; // 4 slots: DL, LB, DB1, DB2 (avg ~T7)
// K is uncapped (just 1 slot)

const OFFENSE_SLOTS = ['qb_card_id', 'rb_card_id', 'wr1_card_id', 'wr2_card_id', 'te_card_id', 'ol_card_id'];
const DEFENSE_SLOTS = ['dl_card_id', 'lb_card_id', 'db1_card_id', 'db2_card_id'];

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

// Calculate tier sums from roster (separate offense and defense)
function calculateTierSums(rosterCards) {
  if (!rosterCards) return { offense: 0, defense: 0 };
  
  let offenseSum = 0;
  for (const slotId of OFFENSE_SLOTS) {
    const card = rosterCards[slotId];
    if (card?.tier) offenseSum += card.tier;
  }
  
  let defenseSum = 0;
  for (const slotId of DEFENSE_SLOTS) {
    const card = rosterCards[slotId];
    if (card?.tier) defenseSum += card.tier;
  }
  
  return { offense: offenseSum, defense: defenseSum };
}

export default function RosterView({ user, diagramSide = 'offense', refreshTrigger = 0 }) {
  const router = useRouter();
  const [roster, setRoster] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showCapWarning, setShowCapWarning] = useState(false);
  const [tappedSlot, setTappedSlot] = useState(null); // For the View/Swap popup
  const [viewingCard, setViewingCard] = useState(null); // For full card modal
  const [detectedStrategy, setDetectedStrategy] = useState(null); // Server-authoritative strategy

  useEffect(() => {
    if (!user) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, refreshTrigger]);

  const loadData = async () => {
    try {
      const [rosterData, cardsData, strategyData] = await Promise.all([
        getRoster(),
        getCards(),
        getRosterStrategy().catch(() => null), // Gracefully handle if endpoint not available
      ]);
      setRoster(rosterData);
      setCards(cardsData.cards);
      if (strategyData) {
        setDetectedStrategy(strategyData);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSlotClick = (slot) => {
    // Show action popup (View Card / Swap)
    setTappedSlot(slot);
  };

  const handleViewCard = () => {
    if (!tappedSlot) return;
    const card = roster?.cards?.[tappedSlot.id];
    if (card) {
      setViewingCard(card);
    }
    setTappedSlot(null);
  };

  const handleSwap = () => {
    if (!tappedSlot) return;
    setSelectedSlot(tappedSlot);
    setTappedSlot(null);
  };

  const handleCardSelect = async (card) => {
    if (!selectedSlot) return;

    // Check if this would exceed the tier cap (offense or defense)
    if (card) {
      const currentCards = roster?.cards || {};
      const currentCardInSlot = currentCards[selectedSlot.id];
      const currentTierInSlot = currentCardInSlot?.tier || 0;
      const sums = calculateTierSums(currentCards);
      
      const isOffenseSlot = OFFENSE_SLOTS.includes(selectedSlot.id);
      const isDefenseSlot = DEFENSE_SLOTS.includes(selectedSlot.id);
      
      if (isOffenseSlot) {
        const newOffenseSum = sums.offense - currentTierInSlot + card.tier;
        if (newOffenseSum > OFFENSE_TIER_CAP) {
          setShowCapWarning('offense');
          return;
        }
      } else if (isDefenseSlot) {
        const newDefenseSum = sums.defense - currentTierInSlot + card.tier;
        if (newDefenseSum > DEFENSE_TIER_CAP) {
          setShowCapWarning('defense');
          return;
        }
      }
      // K slot is uncapped
    }

    setSaving(true);
    try {
      const newRoster = await updateRoster({
        [selectedSlot.id]: card ? card.id : null,
      });
      setRoster(newRoster);
      setSelectedSlot(null);
      // Refresh detected strategy from server
      const strategyData = await getRosterStrategy().catch(() => null);
      if (strategyData) setDetectedStrategy(strategyData);
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

  // Calculate current tier sums (offense and defense separately)
  const tierSums = calculateTierSums(roster?.cards);
  const isOffenseOverCap = tierSums.offense > OFFENSE_TIER_CAP;
  const isDefenseOverCap = tierSums.defense > DEFENSE_TIER_CAP;
  
  // Show the relevant cap based on current tab
  const currentSum = diagramSide === 'offense' ? tierSums.offense : tierSums.defense;
  const currentCap = diagramSide === 'offense' ? OFFENSE_TIER_CAP : DEFENSE_TIER_CAP;
  const isOverCap = diagramSide === 'offense' ? isOffenseOverCap : isDefenseOverCap;
  const sideLabel = diagramSide === 'offense' ? 'Offense' : 'Defense';

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
          
          {/* Tier Cap Display - shows current side's cap */}
          <div 
            className="fixed left-4 z-10 px-3 py-1.5 rounded-lg text-sm font-bold"
            style={{ 
              top: '35px',
              backgroundColor: 'rgba(0,0,0,0.7)',
              border: '1px solid rgba(255,255,255,0.2)',
              fontFamily: "'Rajdhani', sans-serif",
            }}
          >
            <span className="text-gray-400">{sideLabel} Cap = </span>
            <span className="text-white">{currentCap}</span>
          </div>
          
          <div 
            className="fixed right-4 z-10 px-3 py-1.5 rounded-lg text-sm font-bold"
            style={{ 
              top: '35px',
              backgroundColor: 'rgba(0,0,0,0.7)',
              border: `1px solid ${isOverCap ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)'}`,
              fontFamily: "'Rajdhani', sans-serif",
            }}
          >
            <span className="text-gray-400">{sideLabel} Sum = </span>
            <span style={{ color: isOverCap ? '#ef4444' : '#22c55e' }}>{currentSum}</span>
            <span className="text-gray-500">/{currentCap}</span>
          </div>
          
          {/* Detected Strategy Display */}
          {detectedStrategy && (
            <div 
              className="fixed left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 rounded-lg text-sm font-bold"
              style={{ 
                top: '75px',
                backgroundColor: 'rgba(0,0,0,0.7)',
                border: `1px solid ${STRATEGY_COLORS[
                  diagramSide === 'offense' 
                    ? detectedStrategy.offensiveStrategy 
                    : detectedStrategy.defensiveStrategy
                ] || '#a3a3a3'}40`,
                fontFamily: "'Rajdhani', sans-serif",
              }}
            >
              <span className="text-gray-400">Strategy: </span>
              <span style={{ 
                color: STRATEGY_COLORS[
                  diagramSide === 'offense' 
                    ? detectedStrategy.offensiveStrategy 
                    : detectedStrategy.defensiveStrategy
                ] || '#a3a3a3' 
              }}>
                {STRATEGY_LABELS[
                  diagramSide === 'offense' 
                    ? detectedStrategy.offensiveStrategy 
                    : detectedStrategy.defensiveStrategy
                ] || 'Unknown'}
              </span>
            </div>
          )}
        </>
      )}

      {/* Tier Cap Warning Modal */}
      {showCapWarning && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          onClick={() => setShowCapWarning(null)}
        >
          <div
            className="f10-panel p-6 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-white mb-3">
              {showCapWarning === 'offense' ? 'Offense' : 'Defense'} Over Cap
            </h3>
            <p className="text-gray-300 mb-4">
              Adding this player would put your {showCapWarning} over the tier cap of{' '}
              {showCapWarning === 'offense' ? OFFENSE_TIER_CAP : DEFENSE_TIER_CAP}.
            </p>
            <p className="text-gray-400 text-sm mb-6">
              Remove or swap {showCapWarning} players with lower tiers to make room.
            </p>
            <button
              onClick={() => setShowCapWarning(null)}
              className="w-full py-3 rounded-xl font-bold text-white transition-colors"
              style={{ backgroundColor: '#3b82f6' }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Slot Action Popup (View Card / Swap) */}
      {tappedSlot && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setTappedSlot(null)}
        >
          <div
            className="f10-panel p-5 max-w-xs w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Show card info if there's a card in the slot */}
            {roster?.cards?.[tappedSlot.id] ? (
              <>
                <div className="text-center mb-4">
                  <div className="text-gray-400 text-sm">{tappedSlot.label}</div>
                  <div className="text-white font-bold text-lg">
                    {roster.cards[tappedSlot.id].player_name || roster.cards[tappedSlot.id].player}
                  </div>
                  <div className="text-sm" style={{ color: roster.cards[tappedSlot.id].tier >= 9 ? '#EAB308' : roster.cards[tappedSlot.id].tier >= 7 ? '#A855F7' : '#3B82F6' }}>
                    Tier {roster.cards[tappedSlot.id].tier}
                  </div>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={handleViewCard}
                    className="w-full py-3 rounded-xl font-semibold text-white transition-all active:scale-95"
                    style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)' }}
                  >
                    👁️ View Card
                  </button>
                  <button
                    onClick={handleSwap}
                    className="w-full py-3 rounded-xl font-semibold text-white transition-all active:scale-95"
                    style={{ background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.4)' }}
                  >
                    🔄 Swap Player
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-4">
                  <div className="text-gray-400 text-sm">Empty Slot</div>
                  <div className="text-white font-bold text-lg">{tappedSlot.label}</div>
                </div>
                <button
                  onClick={handleSwap}
                  className="w-full py-3 rounded-xl font-semibold text-white transition-all active:scale-95"
                  style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)' }}
                >
                  ➕ Add Player
                </button>
              </>
            )}
            <button
              onClick={() => setTappedSlot(null)}
              className="w-full mt-3 py-2 text-gray-400 hover:text-white transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Full Card View Modal */}
      {viewingCard && (
        <CardModal card={viewingCard} onClose={() => setViewingCard(null)} />
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

            {/* Current Strategy Indicator */}
            {detectedStrategy && (
              <div 
                className="mb-3 p-2 rounded-lg text-sm"
                style={{ 
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  fontFamily: "'Rajdhani', sans-serif",
                }}
              >
                <span className="text-gray-400">Current Strategy: </span>
                <span style={{ 
                  color: STRATEGY_COLORS[
                    OFFENSE_SLOTS.includes(selectedSlot.id) 
                      ? detectedStrategy.offensiveStrategy 
                      : detectedStrategy.defensiveStrategy
                  ] || '#a3a3a3' 
                }}>
                  {STRATEGY_LABELS[
                    OFFENSE_SLOTS.includes(selectedSlot.id) 
                      ? detectedStrategy.offensiveStrategy 
                      : detectedStrategy.defensiveStrategy
                  ] || 'Unknown'}
                </span>
              </div>
            )}
            
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
                    
                    // Calculate strategy preview for this card
                    const isOffenseSlot = OFFENSE_SLOTS.includes(selectedSlot.id);
                    const previewCards = { ...(roster?.cards || {}) };
                    previewCards[selectedSlot.id] = card;
                    const previewStrategy = isOffenseSlot 
                      ? detectOffensiveStrategy(previewCards) 
                      : detectDefensiveStrategy(previewCards);
                    const currentStrategy = isOffenseSlot 
                      ? detectedStrategy?.offensiveStrategy 
                      : detectedStrategy?.defensiveStrategy;
                    const strategyWillChange = previewStrategy !== currentStrategy && !isCurrentlySelected;

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
                          {/* Strategy change indicator */}
                          {strategyWillChange && (
                            <div 
                              className="text-xs mt-1" 
                              style={{ color: STRATEGY_COLORS[previewStrategy] || '#a3a3a3' }}
                            >
                              → {STRATEGY_LABELS[previewStrategy] || previewStrategy}
                            </div>
                          )}
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

