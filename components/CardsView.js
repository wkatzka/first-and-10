import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Card from './Card';
import CardModal from './CardModal';
import { getCards, getPackInfo } from '../lib/api';

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'];
const TIERS = ['ALL', 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export default function CardsView({ user }) {
  const router = useRouter();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('recent');
  const [selectedCard, setSelectedCard] = useState(null);
  const [packsRemaining, setPacksRemaining] = useState(0);
  const [packInfoLoaded, setPackInfoLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadCards();
    loadPackInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadCards = async () => {
    try {
      const data = await getCards();
      setCards(data.cards);
    } catch (err) {
      console.error('Failed to load cards:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPackInfo = async () => {
    try {
      const data = await getPackInfo();
      setPacksRemaining(data.packsRemaining || 0);
    } catch (err) {
      console.error('Failed to load pack info:', err);
    } finally {
      setPackInfoLoaded(true);
    }
  };

  // Filter and sort cards
  const filteredCards = cards
    .filter(c => filter === 'ALL' || c.position === filter)
    .filter(c => tierFilter === 'ALL' || c.tier === tierFilter)
    .sort((a, b) => {
      if (sortBy === 'recent') return b.id - a.id;
      if (sortBy === 'tier-high') return b.tier - a.tier;
      if (sortBy === 'tier-low') return a.tier - b.tier;
      if (sortBy === 'score') return (b.composite_score || 0) - (a.composite_score || 0);
      if (sortBy === 'name') return a.player_name.localeCompare(b.player_name);
      return 0;
    });

  // Stats
  const stats = { total: cards.length, byPosition: {} };
  for (const card of cards) {
    stats.byPosition[card.position] = (stats.byPosition[card.position] || 0) + 1;
  }

  const btnStyle = {
    background: 'rgba(255,255,255,0.06)',
    fontFamily: 'var(--f10-display-font)',
  };

  if (!user) return null;

  return (
    <div className="flex flex-col" style={{ paddingBottom: '80px' }}>
      {/* Top row: Sort by (left) + All Tiers (right) — pulled up 30px into endzone */}
      <div className="flex items-center justify-between" style={{ marginTop: '-6px' }}>
        {/* Sort Dropdown — left */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="appearance-none pl-3 pr-7 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer"
            style={{
              ...btnStyle,
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <option value="recent">Sort by: Recent</option>
            <option value="tier-high">Sort by: Tier ↓</option>
            <option value="tier-low">Sort by: Tier ↑</option>
            <option value="score">Sort by: Score</option>
            <option value="name">Sort by: Name</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Tier Filter Dropdown — right */}
        <div className="relative">
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
            className="appearance-none pl-3 pr-7 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer"
            style={{
              ...btnStyle,
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <option value="ALL">All Tiers</option>
            {TIERS.filter(t => t !== 'ALL').map(t => (
              <option key={t} value={t}>Tier {t}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1.5">
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Position Filter Buttons — pushed down 50px */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto hide-scrollbar" style={{ WebkitOverflowScrolling: 'touch', marginTop: '100px' }}>
        {POSITIONS.map(pos => (
          <button
            key={pos}
            onClick={() => setFilter(pos)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === pos
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-600'
            }`}
            style={{
              background: filter === pos ? undefined : btnStyle.background,
              fontFamily: btnStyle.fontFamily,
            }}
          >
            {pos === 'ALL'
              ? `ALL (${stats.total})`
              : `${pos}${stats.byPosition[pos] ? ` (${stats.byPosition[pos]})` : ''}`
            }
          </button>
        ))}
      </div>

      {/* Cards Grid - 3 columns on mobile */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading cards...</div>
      ) : filteredCards.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          {cards.length === 0 ? 'No cards yet. Open some packs!' : 'No cards match filter.'}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {filteredCards.map(card => (
            <Card
              key={card.id}
              card={card}
              onClick={() => setSelectedCard(card)}
            />
          ))}
        </div>
      )}

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}

      {/* Sticky Pack Banner - fixed just above the bottom tab bar */}
      {packInfoLoaded && (
        <div
          className="fixed left-0 right-0 z-40"
          style={{ bottom: '92px' }}
        >
          <div className="mx-auto max-w-7xl px-3 flex justify-center">
            <button
              onClick={() => {
                if (packsRemaining > 0) {
                  router.push('/packs');
                } else {
                  router.push('/shop');
                }
              }}
              className="inline-flex items-center justify-center gap-2 py-2 px-5 rounded-xl transition-all active:scale-[0.98]"
              style={{
                background: packsRemaining > 0
                  ? 'linear-gradient(135deg, rgba(100,160,220,0.30) 0%, rgba(140,180,230,0.25) 100%)'
                  : 'rgba(255,255,255,0.08)',
                border: packsRemaining > 0
                  ? '1px solid rgba(140,180,230,0.4)'
                  : '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              {/* Pack Image */}
              <img
                src="/pack-banner.png"
                alt="Pack"
                className="flex-shrink-0 object-contain"
                style={{ width: '32px', height: '44px' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />

              {/* Label */}
              <span
                className="text-sm font-bold"
                style={{
                  fontFamily: 'var(--f10-display-font)',
                  color: packsRemaining > 0 ? '#93c5fd' : '#9ca3af',
                }}
              >
                {packsRemaining > 0
                  ? `${packsRemaining} Unopened Pack${packsRemaining !== 1 ? 's' : ''}`
                  : 'Buy Packs'}
              </span>

              {/* Arrow */}
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke={packsRemaining > 0 ? '#93c5fd' : '#9ca3af'} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
