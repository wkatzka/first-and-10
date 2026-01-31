import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { getAllUsers, simulatePractice } from '../lib/api';

export default function Schedule({ user, onLogout, unreadMessages }) {
  const router = useRouter();
  const [todayGames, setTodayGames] = useState([]);
  const [tomorrowGames, setTomorrowGames] = useState([]);
  const [myGames, setMyGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('practice');
  
  // Practice sim state
  const [teams, setTeams] = useState([]);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [practiceResult, setPracticeResult] = useState(null);
  
  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    loadSchedule();
  }, [user, router]);
  
  const loadSchedule = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [todayRes, tomorrowRes, myRes, teamsData] = await Promise.all([
        fetch('/api/schedule/today', { headers }),
        fetch('/api/schedule/tomorrow', { headers }),
        fetch('/api/schedule/my-games', { headers }),
        getAllUsers(),
      ]);
      
      const todayData = await todayRes.json();
      const tomorrowData = await tomorrowRes.json();
      const myData = await myRes.json();
      
      setTodayGames(todayData.games || []);
      setTomorrowGames(tomorrowData.games || []);
      setMyGames(myData.games || []);
      setTeams((teamsData.users || []).filter(t => t.id !== user?.id));
    } catch (err) {
      console.error('Failed to load schedule:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const runPracticeSim = async () => {
    if (!selectedOpponent) return;
    
    setSimulating(true);
    setPracticeResult(null);
    
    try {
      const result = await simulatePractice(selectedOpponent.id);
      setPracticeResult(result);
    } catch (err) {
      alert(err.message || 'Failed to run practice simulation');
    } finally {
      setSimulating(false);
    }
  };
  
  const formatGameStatus = (game) => {
    if (game.status === 'completed') {
      return (
        <span className="text-green-400">
          {game.result?.homeScore} - {game.result?.awayScore}
        </span>
      );
    }
    if (game.status === 'forfeit') {
      return <span className="text-red-400">Forfeit</span>;
    }
    if (game.status === 'bye') {
      return <span className="text-gray-400">Bye Week</span>;
    }
    return <span className="text-yellow-400">{game.timeDisplay}</span>;
  };
  
  const renderGameCard = (game, showDate = false) => {
    const isMyGame = game.homeUserId === user?.id || game.awayUserId === user?.id;
    const amHome = game.homeUserId === user?.id;
    
    return (
      <div
        key={game.id}
        className={`bg-gray-800 rounded-lg p-4 ${isMyGame ? 'ring-2 ring-blue-500' : ''}`}
      >
        {showDate && (
          <div className="text-xs text-gray-500 mb-2">{game.date}</div>
        )}
        
        <div className="flex items-center justify-between">
          {/* Home Team */}
          <div className={`flex-1 text-center ${amHome ? 'text-blue-400' : ''}`}>
            <div className="text-sm text-gray-400">Home</div>
            <div className="font-bold text-white">
              {game.homeUser?.username || 'Unknown'}
              {amHome && <span className="text-xs text-blue-400 ml-1">(You)</span>}
            </div>
          </div>
          
          {/* VS / Score */}
          <div className="px-4 text-center">
            {game.status === 'completed' ? (
              <div className="text-xl font-bold">
                <span className={game.result?.winner === 'home' ? 'text-green-400' : 'text-white'}>
                  {game.result?.homeScore}
                </span>
                <span className="text-gray-500 mx-2">-</span>
                <span className={game.result?.winner === 'away' ? 'text-green-400' : 'text-white'}>
                  {game.result?.awayScore}
                </span>
              </div>
            ) : (
              <div className="text-gray-500">vs</div>
            )}
            <div className="text-xs mt-1">{formatGameStatus(game)}</div>
          </div>
          
          {/* Away Team */}
          <div className={`flex-1 text-center ${!amHome && isMyGame ? 'text-blue-400' : ''}`}>
            <div className="text-sm text-gray-400">Away</div>
            <div className="font-bold text-white">
              {game.awayUser?.username || (game.status === 'bye' ? 'BYE' : 'Unknown')}
              {!amHome && isMyGame && <span className="text-xs text-blue-400 ml-1">(You)</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  if (!user) return null;
  
  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Game Schedule</h1>
          <p className="text-gray-400">
            Games auto-play at 7:00 PM & 9:00 PM EST daily
          </p>
        </div>
        
        {/* Info Box */}
        <div className="max-w-2xl mx-auto bg-blue-900/30 border border-blue-600/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <div className="text-blue-400 font-semibold">Auto-Compete Mode</div>
              <div className="text-sm text-gray-300">
                Your roster plays automatically at scheduled times. 
                Make sure your best lineup is set before game time!
              </div>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-700 overflow-x-auto">
          {['practice', 'today', 'tomorrow', 'my-games'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 font-medium transition-colors whitespace-nowrap text-sm ${
                activeTab === tab
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'practice' && '🏈 Practice'}
              {tab === 'today' && "Today"}
              {tab === 'tomorrow' && "Tomorrow"}
              {tab === 'my-games' && 'My Games'}
            </button>
          ))}
        </div>
        
        {/* Content */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading schedule...</div>
        ) : (
          <div className="space-y-4">
            {activeTab === 'practice' && (
              <div className="max-w-md mx-auto space-y-4">
                <div className="bg-gray-800 rounded-xl p-6">
                  <h2 className="text-xl font-bold text-white mb-2">Practice Simulation</h2>
                  <p className="text-gray-400 text-sm mb-4">
                    Test your roster against another team. Practice games don't affect standings.
                  </p>
                  
                  {/* Opponent Selection */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Select Opponent
                    </label>
                    <select
                      value={selectedOpponent?.id || ''}
                      onChange={(e) => {
                        const team = teams.find(t => t.id === parseInt(e.target.value));
                        setSelectedOpponent(team);
                        setPracticeResult(null);
                      }}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Choose a team...</option>
                      {teams.map(team => (
                        <option key={team.id} value={team.id}>
                          {team.team_name || team.username} ({team.stats?.wins || 0}-{team.stats?.losses || 0})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Run Simulation Button */}
                  <button
                    onClick={runPracticeSim}
                    disabled={!selectedOpponent || simulating}
                    className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {simulating ? 'Simulating...' : '🏈 Run Practice Game'}
                  </button>
                </div>
                
                {/* Practice Result - Post Game Report */}
                {practiceResult && (
                  <div className="bg-gray-800 rounded-xl overflow-hidden">
                    {/* Header with Score */}
                    <div className={`p-6 text-center ${
                      practiceResult.winner === 'you' ? 'bg-green-900/50' : 
                      practiceResult.winner === 'opponent' ? 'bg-red-900/50' : 'bg-yellow-900/50'
                    }`}>
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Practice Game</div>
                      <div className="text-lg font-medium text-white mb-2">
                        {practiceResult.yourTeam || 'You'} vs {practiceResult.opponentTeam || 'Opponent'}
                      </div>
                      <div className="text-5xl font-bold mb-2">
                        <span className={practiceResult.winner === 'you' ? 'text-green-400' : 'text-white'}>
                          {practiceResult.yourScore}
                        </span>
                        <span className="text-gray-500 mx-4">-</span>
                        <span className={practiceResult.winner === 'opponent' ? 'text-red-400' : 'text-white'}>
                          {practiceResult.opponentScore}
                        </span>
                      </div>
                      <div className="text-xl font-bold">
                        {practiceResult.winner === 'you' ? (
                          <span className="text-green-400">VICTORY! 🏆</span>
                        ) : practiceResult.winner === 'opponent' ? (
                          <span className="text-red-400">DEFEAT 😔</span>
                        ) : (
                          <span className="text-yellow-400">TIE GAME</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Team Stats */}
                    {practiceResult.stats && (practiceResult.stats.you || practiceResult.stats.opponent) && (
                      <div className="p-4 border-b border-gray-700">
                        <div className="text-sm font-bold text-white mb-3 text-center">TEAM STATS</div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="text-right text-blue-400 font-medium">
                            {practiceResult.stats.you?.passingYards || 0}
                          </div>
                          <div className="text-center text-gray-400">Pass Yds</div>
                          <div className="text-left text-red-400 font-medium">
                            {practiceResult.stats.opponent?.passingYards || 0}
                          </div>
                          
                          <div className="text-right text-blue-400 font-medium">
                            {practiceResult.stats.you?.rushingYards || 0}
                          </div>
                          <div className="text-center text-gray-400">Rush Yds</div>
                          <div className="text-left text-red-400 font-medium">
                            {practiceResult.stats.opponent?.rushingYards || 0}
                          </div>
                          
                          <div className="text-right text-blue-400 font-medium">
                            {practiceResult.stats.you?.totalYards || 0}
                          </div>
                          <div className="text-center text-gray-400">Total Yds</div>
                          <div className="text-left text-red-400 font-medium">
                            {practiceResult.stats.opponent?.totalYards || 0}
                          </div>
                          
                          <div className="text-right text-blue-400 font-medium">
                            {(practiceResult.stats.you?.interceptions || 0) + (practiceResult.stats.you?.fumbles || 0)}
                          </div>
                          <div className="text-center text-gray-400">Turnovers</div>
                          <div className="text-left text-red-400 font-medium">
                            {(practiceResult.stats.opponent?.interceptions || 0) + (practiceResult.stats.opponent?.fumbles || 0)}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Significant Plays */}
                    {practiceResult.significantPlays && practiceResult.significantPlays.length > 0 && (
                      <div className="p-4">
                        <div className="text-sm font-bold text-white mb-3">KEY PLAYS</div>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {practiceResult.significantPlays.map((play, idx) => (
                            <div 
                              key={idx}
                              className={`text-sm p-2 rounded ${
                                play.team === 'you' 
                                  ? play.type === 'touchdown' ? 'bg-green-900/40 border-l-2 border-green-500'
                                  : play.type === 'big_play' ? 'bg-blue-900/40 border-l-2 border-blue-500'
                                  : 'bg-gray-700/50'
                                  : play.type === 'touchdown' ? 'bg-red-900/40 border-l-2 border-red-500'
                                  : play.type === 'interception' || play.type === 'fumble' 
                                    ? 'bg-orange-900/40 border-l-2 border-orange-500'
                                  : 'bg-gray-700/50'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs">
                                  {play.type === 'touchdown' && '🏈'}
                                  {play.type === 'field_goal' && '🥅'}
                                  {play.type === 'interception' && '🔄'}
                                  {play.type === 'fumble' && '💥'}
                                  {play.type === 'sack' && '💪'}
                                  {play.type === 'big_play' && '⚡'}
                                </span>
                                <span className={`text-xs font-medium ${play.team === 'you' ? 'text-blue-400' : 'text-red-400'}`}>
                                  {play.team === 'you' ? 'YOU' : 'OPP'}
                                </span>
                                {play.quarter && <span className="text-xs text-gray-500">Q{play.quarter}</span>}
                              </div>
                              <div className="text-gray-300">{play.description}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* No significant plays message */}
                    {(!practiceResult.significantPlays || practiceResult.significantPlays.length === 0) && (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        No major highlights in this game
                      </div>
                    )}
                    
                    {/* Play Again Button */}
                    <div className="p-4 border-t border-gray-700">
                      <button
                        onClick={() => setPracticeResult(null)}
                        className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-colors"
                      >
                        Play Again
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'today' && (
              todayGames.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  No games scheduled for today.
                </div>
              ) : (
                todayGames.map(game => renderGameCard(game))
              )
            )}
            
            {activeTab === 'tomorrow' && (
              tomorrowGames.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  Tomorrow's schedule not yet released.
                </div>
              ) : (
                tomorrowGames.map(game => renderGameCard(game))
              )
            )}
            
            {activeTab === 'my-games' && (
              myGames.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  No games scheduled yet. Check back when the season starts!
                </div>
              ) : (
                <>
                  {/* Upcoming */}
                  <h3 className="text-lg font-bold text-white">Upcoming</h3>
                  {myGames.filter(g => g.status === 'scheduled').length === 0 ? (
                    <div className="text-gray-400 text-sm">No upcoming games</div>
                  ) : (
                    myGames
                      .filter(g => g.status === 'scheduled')
                      .slice(0, 10)
                      .map(game => renderGameCard(game, true))
                  )}
                  
                  {/* Completed */}
                  <h3 className="text-lg font-bold text-white mt-6">Completed</h3>
                  {myGames.filter(g => g.status === 'completed').length === 0 ? (
                    <div className="text-gray-400 text-sm">No completed games yet</div>
                  ) : (
                    myGames
                      .filter(g => g.status === 'completed')
                      .slice(0, 10)
                      .map(game => renderGameCard(game, true))
                  )}
                </>
              )
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
