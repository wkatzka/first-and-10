import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import Card, { MiniCard } from '../components/Card';
import CardModal from '../components/CardModal';
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

export default function Roster({ user, onLogout, unreadMessages }) {
  const router = useRouter();
  const [roster, setRoster] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [viewCard, setViewCard] = useState(null);
  
  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    loadData();
  }, [user, router]);
  
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
      if (key.endsWith('_card_id') && value) {
        usedCardIds.add(value);
      }
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
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">My Roster</h1>
            <p className="text-gray-400">
              {filledSlots}/11 starters | Power: {rosterPower}
            </p>
          </div>
          
          <button
            onClick={handleAutoFill}
            disabled={saving || cards.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            Auto-Fill Best Cards
          </button>
        </div>
        
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading roster...</div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Roster Sections */}
            {ROSTER_LAYOUT.map(({ section, slots }) => (
              <div key={section} className="bg-gray-800 rounded-xl p-4">
                <h3 className="text-lg font-bold text-white mb-4">{section}</h3>
                
                <div className="grid grid-cols-4 gap-2">
                  {slots.map(slot => {
                    const card = roster?.cards?.[slot.id];
                    return (
                      <div key={slot.id} className="flex flex-col items-center relative group">
                        <MiniCard
                          card={card}
                          position={slot.label}
                          onClick={() => handleSlotClick(slot)}
                          empty={!card}
                        />
                        {/* View card button */}
                        {card && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewCard(card);
                            }}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            title="View card"
                          >
                            👁
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Card Selection Modal */}
        {selectedSlot && (
          <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedSlot(null)}
          >
            <div 
              className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">
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
                  className="w-full mb-4 py-2 bg-red-600/30 text-red-400 rounded-lg hover:bg-red-600/50 transition-colors"
                >
                  Remove Card from Slot
                </button>
              )}
              
              <p className="text-sm text-gray-400 mb-4">
                Tap to select · Long press to view details
              </p>
              
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {availableCards
                    .sort((a, b) => b.tier - a.tier)
                    .map(card => {
                      const isUsed = usedCardIds.has(card.id) && roster?.cards?.[selectedSlot.id]?.id !== card.id;
                      return (
                        <div
                          key={card.id}
                          className={`relative group ${isUsed ? 'opacity-50' : ''}`}
                        >
                          <Card
                            card={card}
                            small
                            onClick={() => !isUsed && handleCardSelect(card)}
                            selected={roster?.cards?.[selectedSlot.id]?.id === card.id}
                          />
                          {/* View button overlay */}
                          {!isUsed && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewCard(card);
                              }}
                              className="absolute top-1 left-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                              title="View card details"
                            >
                              👁
                            </button>
                          )}
                          {isUsed && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                              <span className="text-xs text-gray-400">In Use</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Card Detail Modal */}
        {viewCard && (
          <CardModal 
            card={viewCard} 
            onClose={() => setViewCard(null)} 
          />
        )}
      </div>
    </Layout>
  );
}
