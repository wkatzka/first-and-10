import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { getLeaderboard } from '../lib/api';

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
  
  const getRankStyle = (rank) => {
    if (rank === 1) return 'bg-yellow-500/20 border-yellow-500';
    if (rank === 2) return 'bg-gray-400/20 border-gray-400';
    if (rank === 3) return 'bg-orange-600/20 border-orange-600';
    return 'bg-gray-800 border-gray-700';
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
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Leaderboard</h1>
          <p className="text-gray-400">Top players ranked by wins</p>
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
                  className={`grid grid-cols-12 gap-2 px-4 py-3 rounded-lg border ${getRankStyle(rank)} ${
                    isCurrentUser ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
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
              );
            })}
          </div>
        )}
        
        {/* Stats Cards */}
        {leaderboard.length > 0 && (
          <div className="max-w-2xl mx-auto grid grid-cols-3 gap-4 mt-8">
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-yellow-400">
                {leaderboard[0]?.username || '-'}
              </div>
              <div className="text-sm text-gray-400">Top Player</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-white">
                {leaderboard.reduce((sum, e) => sum + e.total_games, 0)}
              </div>
              <div className="text-sm text-gray-400">Total Games</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 text-center">
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
