import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { getLeaderboard } from '../lib/api';

const NAV_PURPLE = '#a855f7';

export default function Leaderboard({ user, onLogout, unreadMessages }) {
  const router = useRouter();
  const [view, setView] = useState('standings');
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
  const buttonFont = { fontFamily: 'var(--f10-display-font)' };
  
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
      <div className="space-y-6">
        {/* Toggle Buttons */}
        <div className="flex justify-center">
          <div className="flex p-1 bg-black/30 backdrop-blur border border-white/10 rounded-2xl shadow-lg">
            <button 
              type="button" 
              onClick={() => router.push('/schedule')}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 text-gray-400 hover:text-white"
              style={buttonFont}
            >
              Schedule
            </button>
            <button 
              type="button" 
              onClick={() => setView('standings')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${view === 'standings' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
              style={view === 'standings' ? { ...activeSegmentStyle, ...buttonFont } : buttonFont}
            >
              Standings
            </button>
          </div>
        </div>
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl f10-title text-white mb-2">Leaderboard</h1>
          <p className="f10-subtitle">Top players ranked by wins</p>
        </div>
        
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading leaderboard...</div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            No games played yet. Be the first to compete!
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-2">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-sm text-gray-400 font-medium">
              <div className="col-span-1">Rank</div>
              <div className="col-span-5">Player</div>
              <div className="col-span-2 text-center">Games</div>
              <div className="col-span-2 text-center">W-L-T</div>
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
                  <div className="grid grid-cols-12 gap-2 px-4 py-3">
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
                      <span className="text-gray-500">-</span>
                      <span className="text-yellow-400">{entry.ties}</span>
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
                          fontFamily: 'var(--f10-display-font)'
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
                          fontFamily: 'var(--f10-display-font)'
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
              <div className="text-3xl font-bold text-yellow-400">
                {leaderboard[0]?.username || '-'}
              </div>
              <div className="text-sm text-gray-400">Top Player</div>
            </div>
            <div className="f10-panel p-4 text-center">
              <div className="text-3xl font-bold text-white">
                {leaderboard.reduce((sum, e) => sum + e.total_games, 0)}
              </div>
              <div className="text-sm text-gray-400">Total Games</div>
            </div>
            <div className="f10-panel p-4 text-center">
              <div className="text-3xl font-bold text-blue-400">
                {leaderboard.length}
              </div>
              <div className="text-sm text-gray-400">Active Players</div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
