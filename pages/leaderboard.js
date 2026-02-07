import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { getLeaderboard } from '../lib/api';

const NAV_PURPLE = '#a855f7';
const DISPLAY_FONT = { fontFamily: 'var(--f10-display-font)' };

export default function Leaderboard({ user, onLogout, unreadMessages }) {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    loadLeaderboard();
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
              <div className="col-span-5">Player</div>
              <div className="col-span-2 text-center">Games</div>
              <div className="col-span-2 text-center">W-L</div>
              <div className="col-span-2 text-right">Win %</div>
            </div>
            
            {/* Leaderboard Entries */}
            {leaderboard.map((entry, index) => {
              const rank = index + 1;
              const winPct = entry.total_games > 0 
                ? ((entry.wins / entry.total_games) * 100).toFixed(1) 
                : '0.0';
              const isCurrentUser = entry.id === user.id;
              
              return (
                <div
                  key={entry.id}
                  className={`rounded-2xl border f10-panel-soft ${getRankStyle(rank)} ${
                    isCurrentUser ? 'ring-2 ring-white/20' : ''
                  }`}
                >
                  <div className="grid grid-cols-12 gap-2 px-4 py-3" style={DISPLAY_FONT}>
                    <div className="col-span-1 flex items-center">
                      <span className={`${rank <= 3 ? 'text-xl' : 'text-gray-400'}`}>
                        {getRankIcon(rank)}
                      </span>
                    </div>
                    <div className="col-span-5 flex items-center">
                      <span className={`font-medium ${isCurrentUser ? 'text-blue-400' : 'text-white'}`}>
                        {entry.username}
                        {isCurrentUser && <span className="ml-2 text-xs text-gray-400">(You)</span>}
                      </span>
                    </div>
                    <div className="col-span-2 text-center text-gray-300">
                      {entry.total_games}
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-green-400">{entry.wins}</span>
                      <span className="text-gray-500">-</span>
                      <span className="text-red-400">{entry.losses}</span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className={`font-bold ${
                        parseFloat(winPct) >= 60 ? 'text-green-400' :
                        parseFloat(winPct) >= 40 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {winPct}%
                      </span>
                    </div>
                  </div>
                  {/* Action buttons for other users */}
                  {!isCurrentUser && (
                    <div className="flex gap-2 px-4 pb-3">
                      <button
                        onClick={() => router.push(`/players?user=${entry.id}`)}
                        className="flex-1 py-2 text-xs font-medium rounded-lg transition-colors"
                        style={{ 
                          background: 'rgba(255,0,128,0.15)', 
                          border: '1px solid rgba(255,0,128,0.3)',
                          color: '#ff0080',
                          ...DISPLAY_FONT
                        }}
                      >
                        View Cards
                      </button>
                      <button
                        onClick={() => router.push(`/league?chat=${entry.id}`)}
                        className="flex-1 py-2 text-xs font-medium rounded-lg transition-colors"
                        style={{ 
                          background: 'rgba(0,229,255,0.15)', 
                          border: '1px solid rgba(0,229,255,0.3)',
                          color: '#00e5ff',
                          ...DISPLAY_FONT
                        }}
                      >
                        Message
                      </button>
                    </div>
                  )}
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
      </div>
    </Layout>
  );
}
