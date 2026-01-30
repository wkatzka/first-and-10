import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { getOpponents, challengeOpponent, quickMatch, getGameHistory } from '../lib/api';

export default function Play({ user, onLogout, onOpenConference, activeConferences = [], unreadMessages }) {
  const router = useRouter();
  const [opponents, setOpponents] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [activeTab, setActiveTab] = useState('opponents');
  
  // Check if a game has an active press conference
  const hasActiveConference = (gameId) => {
    return activeConferences.some(c => c.gameId === gameId);
  };
  
  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    loadData();
  }, [user, router]);
  
  const loadData = async () => {
    try {
      const [opponentsData, gamesData] = await Promise.all([
        getOpponents(),
        getGameHistory(),
      ]);
      setOpponents(opponentsData.opponents);
      setGames(gamesData.games);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleChallenge = async (opponentId) => {
    setPlaying(true);
    setGameResult(null);
    
    try {
      const result = await challengeOpponent(opponentId);
      setGameResult(result);
      loadData(); // Refresh history
    } catch (err) {
      console.error('Game failed:', err);
      alert(err.message);
    } finally {
      setPlaying(false);
    }
  };
  
  const handleQuickMatch = async () => {
    setPlaying(true);
    setGameResult(null);
    
    try {
      const result = await quickMatch();
      setGameResult(result);
      loadData(); // Refresh history
    } catch (err) {
      console.error('Quick match failed:', err);
      alert(err.message);
    } finally {
      setPlaying(false);
    }
  };
  
  if (!user) return null;
  
  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Play</h1>
          <p className="text-gray-400">Challenge other players to a head-to-head game</p>
        </div>
        
        {/* Quick Match Button */}
        <div className="max-w-md mx-auto">
          <button
            onClick={handleQuickMatch}
            disabled={playing}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-lg rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50 shadow-lg"
          >
            {playing ? 'Playing...' : 'Quick Match'}
          </button>
          <p className="text-center text-gray-500 text-sm mt-2">Play against a random opponent</p>
        </div>
        
        {/* Game Result Modal */}
        {gameResult && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
              <div className="text-center">
                {/* Result Header */}
                <div className={`text-4xl mb-4 ${
                  gameResult.winner === 'home' ? 'text-green-400' :
                  gameResult.winner === 'away' ? 'text-red-400' :
                  'text-yellow-400'
                }`}>
                  {gameResult.winner === 'home' ? 'VICTORY!' :
                   gameResult.winner === 'away' ? 'DEFEAT' :
                   'TIE'}
                </div>
                
                {/* Score */}
                <div className="flex items-center justify-center gap-8 mb-6">
                  <div className="text-center">
                    <div className="text-sm text-gray-400 mb-1">{gameResult.home.username}</div>
                    <div className={`text-5xl font-bold ${
                      gameResult.winner === 'home' ? 'text-green-400' : 'text-white'
                    }`}>
                      {gameResult.home.score}
                    </div>
                  </div>
                  <div className="text-2xl text-gray-500">vs</div>
                  <div className="text-center">
                    <div className="text-sm text-gray-400 mb-1">{gameResult.away.username}</div>
                    <div className={`text-5xl font-bold ${
                      gameResult.winner === 'away' ? 'text-green-400' : 'text-white'
                    }`}>
                      {gameResult.away.score}
                    </div>
                  </div>
                </div>
                
                {/* Summary */}
                {gameResult.summary && (
                  <div className="text-sm text-gray-400 mb-4">
                    {gameResult.summary.totalPlays} plays
                  </div>
                )}
                
                {/* Press Conference Button */}
                {gameResult.pressConference?.available && (
                  <button
                    onClick={() => {
                      setGameResult(null);
                      onOpenConference?.(gameResult.gameId);
                    }}
                    className="w-full py-3 mb-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>🎤</span>
                    Post-Game Press Conference
                  </button>
                )}
                
                <button
                  onClick={() => setGameResult(null)}
                  className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Play Again
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('opponents')}
            className={`pb-2 px-4 font-medium transition-colors ${
              activeTab === 'opponents'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Opponents
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2 px-4 font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Game History
          </button>
        </div>
        
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading...</div>
        ) : activeTab === 'opponents' ? (
          /* Opponents List */
          <div className="space-y-3">
            {opponents.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                No other players yet. Invite some friends!
              </div>
            ) : (
              opponents.map(opponent => (
                <div
                  key={opponent.id}
                  className="bg-gray-800 rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="text-white font-medium">{opponent.username}</div>
                    <div className="text-sm text-gray-400">
                      {opponent.stats?.wins || 0}W - {opponent.stats?.losses || 0}L
                    </div>
                  </div>
                  <button
                    onClick={() => handleChallenge(opponent.id)}
                    disabled={playing}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    Challenge
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Game History */
          <div className="space-y-3">
            {games.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                No games played yet. Start your first match!
              </div>
            ) : (
              games.map(game => {
                const isHome = game.home_user_id === user.id;
                const won = (isHome && game.home_score > game.away_score) || 
                           (!isHome && game.away_score > game.home_score);
                const tied = game.home_score === game.away_score;
                const opponent = isHome ? game.away_username : game.home_username;
                const myScore = isHome ? game.home_score : game.away_score;
                const theirScore = isHome ? game.away_score : game.home_score;
                const conferenceActive = hasActiveConference(game.id);
                
                return (
                  <div
                    key={game.id}
                    className={`bg-gray-800 rounded-lg p-4 flex items-center justify-between border-l-4 ${
                      won ? 'border-green-500' : tied ? 'border-yellow-500' : 'border-red-500'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${
                          won ? 'text-green-400' : tied ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {won ? 'WIN' : tied ? 'TIE' : 'LOSS'}
                        </span>
                        <span className="text-white">vs {opponent}</span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {new Date(game.played_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {conferenceActive && (
                        <button
                          onClick={() => onOpenConference?.(game.id)}
                          className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
                        >
                          <span>🎤</span>
                          Chat
                        </button>
                      )}
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">
                          {myScore} - {theirScore}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
