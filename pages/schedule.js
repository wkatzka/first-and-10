import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';

export default function Schedule({ user, onLogout }) {
  const router = useRouter();
  const [todayGames, setTodayGames] = useState([]);
  const [tomorrowGames, setTomorrowGames] = useState([]);
  const [myGames, setMyGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('today');
  
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
      
      const [todayRes, tomorrowRes, myRes] = await Promise.all([
        fetch('/api/schedule/today', { headers }),
        fetch('/api/schedule/tomorrow', { headers }),
        fetch('/api/schedule/my-games', { headers }),
      ]);
      
      const todayData = await todayRes.json();
      const tomorrowData = await tomorrowRes.json();
      const myData = await myRes.json();
      
      setTodayGames(todayData.games || []);
      setTomorrowGames(tomorrowData.games || []);
      setMyGames(myData.games || []);
    } catch (err) {
      console.error('Failed to load schedule:', err);
    } finally {
      setLoading(false);
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
    <Layout user={user} onLogout={onLogout}>
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
        <div className="flex gap-2 border-b border-gray-700">
          {['today', 'tomorrow', 'my-games'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === tab
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'today' && "Today's Games"}
              {tab === 'tomorrow' && "Tomorrow's Games"}
              {tab === 'my-games' && 'My Schedule'}
            </button>
          ))}
        </div>
        
        {/* Content */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading schedule...</div>
        ) : (
          <div className="space-y-4">
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
