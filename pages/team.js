import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import RosterView from '../components/RosterView';
import StrategySlider from '../components/StrategySlider';
import OpponentScout from '../components/OpponentScout';
import { getRosterStrategy, getUserRoster, getRosterLockStatus } from '../lib/api';

const NAV_CYAN = '#00e5ff';
const NAV_PURPLE = '#a855f7';

export default function Team({ user, onLogout, unreadMessages }) {
  const router = useRouter();
  const [diagramSide, setDiagramSide] = useState('offense');
  const [detectedStrategy, setDetectedStrategy] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sliderKey, setSliderKey] = useState(0);
  
  // Scouting state
  const [upcomingGames, setUpcomingGames] = useState([]);
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const [opponentRoster, setOpponentRoster] = useState(null);
  const [loadingOpponent, setLoadingOpponent] = useState(false);
  
  // Roster lock state
  const [rosterLock, setRosterLock] = useState({ locked: false });

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
  }, [user, router]);

  // Check roster lock status periodically
  useEffect(() => {
    if (!user) return;
    const checkLock = async () => {
      try {
        const status = await getRosterLockStatus();
        setRosterLock(status);
      } catch (err) {
        console.error('Failed to check lock status:', err);
      }
    };
    checkLock();
    // Check every 30 seconds to catch when lock window starts
    const interval = setInterval(checkLock, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Fetch upcoming games
  useEffect(() => {
    if (!user) return;
    const fetchGames = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/schedule/my-games', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        // Filter to only upcoming (scheduled) games
        const upcoming = (data.games || [])
          .filter(g => g.status === 'scheduled')
          .slice(0, 2); // Get next 2 games
        setUpcomingGames(upcoming);
      } catch (err) {
        console.error('Failed to fetch upcoming games:', err);
      }
    };
    fetchGames();
  }, [user]);

  // Fetch opponent roster when game is selected
  useEffect(() => {
    if (upcomingGames.length === 0) return;
    const game = upcomingGames[selectedGameIndex];
    if (!game) return;
    
    const opponentId = game.homeUserId === user?.id ? game.awayUserId : game.homeUserId;
    if (!opponentId) return;
    
    const fetchOpponentRoster = async () => {
      setLoadingOpponent(true);
      try {
        const data = await getUserRoster(opponentId);
        setOpponentRoster(data);
      } catch (err) {
        console.error('Failed to fetch opponent roster:', err);
        setOpponentRoster(null);
      } finally {
        setLoadingOpponent(false);
      }
    };
    fetchOpponentRoster();
  }, [upcomingGames, selectedGameIndex, user?.id]);

  // Fetch detected strategy on mount and when roster changes
  const fetchStrategy = useCallback(async () => {
    try {
      const data = await getRosterStrategy();
      setDetectedStrategy(data);
    } catch (err) {
      console.error('Failed to fetch strategy:', err);
    }
  }, []);

  useEffect(() => {
    if (user) fetchStrategy();
  }, [user, refreshTrigger, fetchStrategy]);

  // Called when slider applies a preset - refresh roster view and strategy
  const handlePresetApplied = useCallback(() => {
    setRefreshTrigger((t) => t + 1);
  }, []);

  // Reload slider presets when side changes
  useEffect(() => {
    setSliderKey(k => k + 1);
  }, [diagramSide]);

  if (!user) return null;

  const activeSegmentStyle = { backgroundColor: `${NAV_CYAN}20`, border: `2px solid ${NAV_CYAN}`, boxShadow: `0 0 12px ${NAV_CYAN}80` };
  const activeGameStyle = { backgroundColor: `${NAV_PURPLE}20`, border: `2px solid ${NAV_PURPLE}`, boxShadow: `0 0 12px ${NAV_PURPLE}80` };
  const buttonFont = { fontFamily: "'Rajdhani', sans-serif" };
  
  // Get current opponent info
  const currentGame = upcomingGames[selectedGameIndex];
  const opponentName = currentGame 
    ? (currentGame.homeUserId === user?.id ? currentGame.awayUser?.username : currentGame.homeUser?.username) 
    : null;

  // Inline the bar content directly instead of creating local component functions.
  // Local components (const Bar = ...) create a NEW function identity each render,
  // causing React to unmount + remount StrategySlider, losing all state.

  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <div className="pb-28 md:pb-0">
        {/* Game Selection Buttons - thinner */}
        {upcomingGames.length > 0 && (
          <div className="flex justify-center mb-1" style={{ marginTop: '-3px' }}>
            <div className="flex p-0.5 bg-black/30 backdrop-blur border border-white/10 rounded-xl shadow-lg">
              {upcomingGames.map((game, idx) => {
                const oppName = game.homeUserId === user?.id 
                  ? game.awayUser?.username 
                  : game.homeUser?.username;
                return (
                  <button 
                    key={game.id || idx}
                    type="button" 
                    onClick={() => setSelectedGameIndex(idx)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-200 ${selectedGameIndex === idx ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                    style={selectedGameIndex === idx ? { ...activeGameStyle, ...buttonFont } : buttonFont}
                  >
                    Game {idx + 1}: vs {oppName || 'TBD'}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Opponent Scout Section - shows opposite side of what you're viewing */}
        {opponentRoster && (
          <OpponentScout 
            opponentRoster={opponentRoster}
            opponentName={opponentName}
            opponentId={currentGame ? (currentGame.homeUserId === user?.id ? currentGame.awayUserId : currentGame.homeUserId) : null}
            loading={loadingOpponent}
            showSide={diagramSide === 'offense' ? 'defense' : 'offense'}
          />
        )}

        {/* Roster Lock Warning */}
        {rosterLock.locked && (
          <div className="flex justify-center mb-2">
            <div 
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ 
                backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                fontFamily: 'var(--f10-display-font)',
              }}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Roster Locked — Game {rosterLock.gameNum} at {rosterLock.gameTime}
            </div>
          </div>
        )}

        {/* Desktop: bar at top, same row */}
        <div className="hidden md:block max-w-md mb-4 relative z-50">
          <div className="flex gap-2 items-center">
            <div className="flex p-1 bg-black/30 backdrop-blur border border-white/10 rounded-2xl shadow-lg">
              <button type="button" onClick={() => setDiagramSide('offense')}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${diagramSide === 'offense' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                style={diagramSide === 'offense' ? { ...activeSegmentStyle, ...buttonFont } : buttonFont}>Offense</button>
              <button type="button" onClick={() => setDiagramSide('defense')}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${diagramSide === 'defense' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                style={diagramSide === 'defense' ? { ...activeSegmentStyle, ...buttonFont } : buttonFont}>Defense</button>
            </div>
            <div className="flex-1 min-w-0">
              <StrategySlider key={`desktop-${sliderKey}`} side={diagramSide} detectedStrategy={detectedStrategy} onPresetApplied={handlePresetApplied} disabled={rosterLock.locked} />
            </div>
          </div>
        </div>

        {/* Add top margin when opponent scout is shown to create space */}
        <div style={{ marginTop: opponentRoster ? '21px' : '5px' }}>
          <RosterView user={user} diagramSide={diagramSide} refreshTrigger={refreshTrigger} disabled={rosterLock.locked} />
        </div>
      </div>

      {/* Mobile: bar fixed above bottom nav with clearance so buttons aren't cut off by tiles */}
      <div className="md:hidden fixed left-0 right-0 z-40 px-3 safe-area-pb" style={{ bottom: 'calc(7.25rem - 22px)' }}>
        <div className="mx-auto max-w-7xl">
          {/* Mobile lock warning - compact */}
          {rosterLock.locked && (
            <div 
              className="flex items-center justify-center gap-1.5 mb-1 px-2 py-1 rounded-lg text-[10px] font-bold"
              style={{ 
                backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                fontFamily: 'var(--f10-display-font)',
              }}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Locked — Game {rosterLock.gameNum}
            </div>
          )}
          <div className="flex gap-2 items-center">
            <div className="flex p-1 bg-black/30 backdrop-blur border border-white/10 rounded-2xl shadow-lg">
              <button type="button" onClick={() => setDiagramSide('offense')}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${diagramSide === 'offense' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                style={diagramSide === 'offense' ? { ...activeSegmentStyle, ...buttonFont } : buttonFont}>Offense</button>
              <button type="button" onClick={() => setDiagramSide('defense')}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${diagramSide === 'defense' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                style={diagramSide === 'defense' ? { ...activeSegmentStyle, ...buttonFont } : buttonFont}>Defense</button>
            </div>
            <div className="flex-1 min-w-0">
              <StrategySlider key={`mobile-${sliderKey}`} side={diagramSide} detectedStrategy={detectedStrategy} onPresetApplied={handlePresetApplied} disabled={rosterLock.locked} />
            </div>
          </div>
        </div>
      </div>

    </Layout>
  );
}
