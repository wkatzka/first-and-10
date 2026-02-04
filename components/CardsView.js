import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Card from './Card';
import CardModal from './CardModal';
import { getCards } from '../lib/api';

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'];

export default function CardsView({ user }) {
  const router = useRouter();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('recent');
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    if (!user) return;
    loadCards();
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

  // Filter and sort cards
  const filteredCards = cards
    .filter(c => filter === 'ALL' || c.position === filter)
    .sort((a, b) => {
      if (sortBy === 'recent') return b.id - a.id; // Higher ID = more recently minted
      if (sortBy === 'tier') return b.tier - a.tier;
      if (sortBy === 'score') return (b.composite_score || 0) - (a.composite_score || 0);
      if (sortBy === 'season') return b.season - a.season;
      if (sortBy === 'name') return a.player_name.localeCompare(b.player_name);
      return 0;
    });

  // Stats
  const stats = {
    total: cards.length,
    byTier: {},
    byPosition: {},
  };

  for (const card of cards) {
    stats.byTier[card.tier] = (stats.byTier[card.tier] || 0) + 1;
    stats.byPosition[card.position] = (stats.byPosition[card.position] || 0) + 1;
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl f10-title text-white">My Cards</h1>
          <p className="f10-subtitle">{cards.length} cards in collection</p>
        </div>

        {cards.length === 0 && !loading && (
          <button
            onClick={() => router.push('/cards')}
            className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all"
          >
            Open Your First Pack!
          </button>
        )}
      </div>

      {/* Tier Distribution */}
      {cards.length > 0 && (
        <div className="f10-panel p-4">
          <h3 className="text-sm text-gray-400 mb-2">Tier Distribution</h3>
          <div className="flex flex-wrap gap-2">
            {[11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(tier => (
              <div
                key={tier}
                className={`px-3 py-1 rounded text-sm ${stats.byTier[tier] ? 'text-white' : 'text-gray-600'}`}
                style={{
                  backgroundColor: stats.byTier[tier] ? `var(--tier-${tier})` : '#374151',
                  color: tier >= 9 && stats.byTier[tier] ? '#000' : undefined,
                }}
              >
                T{tier}: {stats.byTier[tier] || 0}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Position Filter */}
        <div className="flex flex-wrap gap-1">
          {POSITIONS.map(pos => (
            <button
              key={pos}
              onClick={() => setFilter(pos)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                filter === pos
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {pos} {pos !== 'ALL' && stats.byPosition[pos] ? `(${stats.byPosition[pos]})` : ''}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-1.5 f10-input text-white rounded text-sm"
        >
          <option value="recent">Recently Minted</option>
          <option value="tier">Sort by Tier</option>
          <option value="score">Sort by Score</option>
          <option value="season">Sort by Season</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading cards...</div>
      ) : filteredCards.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          {cards.length === 0 ? 'No cards yet. Open some packs!' : 'No cards match filter.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredCards.map(card => (
            <Card
              key={card.id}
              card={card}
              onClick={() => setSelectedCard(card)}
            />
          ))}
        </div>
      )}

      {/* Card Detail Modal with Flip */}
      {selectedCard && (
        <CardModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}

