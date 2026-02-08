import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import Card from '../components/Card';
import CardModal from '../components/CardModal';
import { getLeaderboard, getH2HRecords, getUserCards } from '../lib/api';

const NAV_PURPLE = '#a855f7';
const DISPLAY_FONT = { fontFamily: 'var(--f10-display-font)' };

export default function Leaderboard({ user, onLogout, unreadMessages }) {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [h2h, setH2H] = useState({});
  // Collection modal state
  const [viewingUser, setViewingUser] = useState(null);
  const [viewingCards, setViewingCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  
  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    loadLeaderboard();
    loadH2H();
  }, [user, router]);
  
  const loadLeaderboard = async () => {
    try {
      const data = await getLeaderboard(50);
      setLeaderboard(data.leaderboard);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadH2H = async () => {
    try {
      const data = await getH2HRecords();
      setH2H(data.records || {});
    } catch (err) {
      console.error('Failed to load h2h:', err);
    }
  };

  const openCollection = async (entry) => {
    setViewingUser(entry);
    setLoadingCards(true);
    setViewingCards([]);
    try {
      const data = await getUserCards(entry.id);
      setViewingCards(data.cards || []);
    } catch (err) {
      console.error('Failed to load cards:', err);
    } finally {
      setLoadingCards(false);
    }
  };

  const closeCollection = () => {
    setViewingUser(null);
    setViewingCards([]);
  };
  
  const activeSegmentStyle = { 
    backgroundColor: `${NAV_PURPLE}20`, 
    border: `2px solid ${NAV_PURPLE}`, 
    boxShadow: `0 0 12px ${NAV_PURPLE}80` 
  };
  
  const getRankStyle = (rank) => {
    if (rank === 1) return 'border-yellow-500/40';
    if (rank === 2) return 'border-gray-300/30';
    if (rank === 3) return 'border-orange-500/40';
    return 'border-white/10';
  };
  
  const getRankIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };
  
  if (!user) return null;
  
  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <div className="pb-28 md:pb-0">
        {/* Fixed Schedule/Standings Toggle */}
        <div className="fixed left-0 right-0 z-20 flex justify-center" style={{ top: '14px' }}>
          <div className="flex p-0.5 bg-black/30 backdrop-blur border border-white/10 rounded-xl shadow-lg">
            <button 
              type="button" 
              onClick={() => router.push('/schedule')}
              className="px-3 py-1 rounded-lg text-xs font-bold transition-all duration-200 text-gray-400 hover:text-white"
              style={DISPLAY_FONT}
            >
              Schedule
            </button>
            <button 
              type="button" 
              className="px-3 py-1 rounded-lg text-xs font-bold transition-all duration-200 text-white"
              style={{ ...activeSegmentStyle, ...DISPLAY_FONT }}
            >
              Standings
            </button>
          </div>
        </div>
        
        {/* Content positioned below endzone */}
        <div style={{ marginTop: 'max(150px, calc(26vh - 30px))' }}>
        {loading ? (
          <div className="text-center text-gray-400 py-12" style={DISPLAY_FONT}>Loading leaderboard...</div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center text-gray-400 py-12" style={DISPLAY_FONT}>
            No games played yet. Be the first to compete!
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-2">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-sm text-gray-400 font-medium" style={DISPLAY_FONT}>
              <div className="col-span-1">Rank</div>
              <div className="col-span-3">Player</div>
              <div className="col-span-2 text-center">W-L</div>
              <div className="col-span-2 text-center">Win %</div>
              <div className="col-span-2 text-center">vs You</div>
              <div className="col-span-2 text-right"></div>
            </div>
            
            {/* Leaderboard Entries */}
            {leaderboard.map((entry, index) => {
              const rank = index + 1;
              const winPct = entry.total_games > 0 
                ? ((entry.wins / entry.total_games) * 100).toFixed(1) 
                : '0.0';
              const isCurrentUser = entry.id === user.id;
              const record = h2h[entry.id];
              
              return (
                <div
                  key={entry.id}
                  className={`rounded-2xl border f10-panel-soft ${getRankStyle(rank)} ${
                    isCurrentUser ? 'ring-2 ring-white/20' : ''
                  }`}
                >
                  <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center" style={DISPLAY_FONT}>
                    <div className="col-span-1 flex items-center">
                      <span className={`${rank <= 3 ? 'text-xl' : 'text-gray-400'}`}>
                        {getRankIcon(rank)}
                      </span>
                    </div>
                    <div className="col-span-3 flex items-center">
                      <span className={`font-medium text-sm ${isCurrentUser ? 'text-blue-400' : 'text-white'}`}>
                        {entry.username}
                        {isCurrentUser && <span className="ml-1 text-xs text-gray-400">(You)</span>}
                      </span>
                    </div>
                    <div className="col-span-2 text-center text-sm">
                      <span className="text-green-400">{entry.wins}</span>
                      <span className="text-gray-500">-</span>
                      <span className="text-red-400">{entry.losses}</span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className={`font-bold text-sm ${
                        parseFloat(winPct) >= 60 ? 'text-green-400' :
                        parseFloat(winPct) >= 40 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {winPct}%
                      </span>
                    </div>
                    <div className="col-span-2 text-center text-sm">
                      {isCurrentUser ? (
                        <span className="text-gray-500">—</span>
                      ) : record ? (
                        <>
                          <span className="text-green-400">{record.wins}</span>
                          <span className="text-gray-500">-</span>
                          <span className="text-red-400">{record.losses}</span>
                          {record.ties > 0 && (
                            <>
                              <span className="text-gray-500">-</span>
                              <span className="text-gray-400">{record.ties}</span>
                            </>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-500">0-0</span>
                      )}
                    </div>
                    <div className="col-span-2 flex justify-end gap-1">
                      {!isCurrentUser && (
                        <>
                          <button
                            onClick={() => openCollection(entry)}
                            className="px-2 py-1 text-[10px] font-medium rounded-lg transition-colors"
                            style={{ 
                              background: 'rgba(255,0,128,0.15)', 
                              border: '1px solid rgba(255,0,128,0.3)',
                              color: '#ff0080',
                              ...DISPLAY_FONT
                            }}
                          >
                            Cards
                          </button>
                          <button
                            onClick={() => router.push(`/league?chat=${entry.id}`)}
                            className="px-2 py-1 text-[10px] font-medium rounded-lg transition-colors"
                            style={{ 
                              background: 'rgba(0,229,255,0.15)', 
                              border: '1px solid rgba(0,229,255,0.3)',
                              color: '#00e5ff',
                              ...DISPLAY_FONT
                            }}
                          >
                            Msg
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Stats Cards */}
        {leaderboard.length > 0 && (
          <div className="max-w-2xl mx-auto grid grid-cols-3 gap-4 mt-8">
            <div className="f10-panel p-4 text-center">
              <div className="text-3xl font-bold text-yellow-400" style={DISPLAY_FONT}>
                {leaderboard[0]?.username || '-'}
              </div>
              <div className="text-sm text-gray-400" style={DISPLAY_FONT}>Top Player</div>
            </div>
            <div className="f10-panel p-4 text-center">
              <div className="text-3xl font-bold text-white" style={DISPLAY_FONT}>
                {leaderboard.reduce((sum, e) => sum + e.total_games, 0)}
              </div>
              <div className="text-sm text-gray-400" style={DISPLAY_FONT}>Total Games</div>
            </div>
            <div className="f10-panel p-4 text-center">
              <div className="text-3xl font-bold text-blue-400" style={DISPLAY_FONT}>
                {leaderboard.length}
              </div>
              <div className="text-sm text-gray-400" style={DISPLAY_FONT}>Active Players</div>
            </div>
          </div>
        )}
        </div>

        {/* Collection Modal */}
        {viewingUser && (
          <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={closeCollection}
          >
            <div 
              className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white" style={DISPLAY_FONT}>
                    {viewingUser.username}'s Collection
                  </h2>
                  <p className="text-sm text-gray-400" style={DISPLAY_FONT}>
                    {viewingCards.length} cards
                  </p>
                </div>
                <button
                  onClick={closeCollection}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              
              {loadingCards ? (
                <div className="text-center text-gray-400 py-8" style={DISPLAY_FONT}>Loading cards...</div>
              ) : viewingCards.length === 0 ? (
                <div className="text-center text-gray-400 py-8" style={DISPLAY_FONT}>
                  No cards in collection
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {viewingCards
                    .sort((a, b) => b.tier - a.tier)
                    .map(card => (
                      <Card 
                        key={card.id} 
                        card={card} 
                        onClick={() => setSelectedCard(card)}
                      />
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Card Detail Modal */}
        {selectedCard && (
          <CardModal 
            card={selectedCard} 
            onClose={() => setSelectedCard(null)} 
          />
        )}
      </div>
    </Layout>
  );
}
