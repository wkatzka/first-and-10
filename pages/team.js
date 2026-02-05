import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import RosterView from '../components/RosterView';
import StrategySlider from '../components/StrategySlider';
import { getRosterStrategy } from '../lib/api';

const NAV_CYAN = '#00e5ff';

export default function Team({ user, onLogout, unreadMessages }) {
  const router = useRouter();
  const [diagramSide, setDiagramSide] = useState('offense');
  const [detectedStrategy, setDetectedStrategy] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sliderKey, setSliderKey] = useState(0);

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
  }, [user, router]);

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
  const buttonFont = { fontFamily: "'Rajdhani', sans-serif" };
  const OffenseDefenseSegment = () => (
    <div className="flex p-1 bg-black/30 backdrop-blur border border-white/10 rounded-2xl shadow-lg">
      <button
        type="button"
        onClick={() => setDiagramSide('offense')}
        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
          diagramSide === 'offense' ? 'text-white' : 'text-gray-400 hover:text-white'
        }`}
        style={diagramSide === 'offense' ? { ...activeSegmentStyle, ...buttonFont } : buttonFont}
      >
        Offense
      </button>
      <button
        type="button"
        onClick={() => setDiagramSide('defense')}
        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
          diagramSide === 'defense' ? 'text-white' : 'text-gray-400 hover:text-white'
        }`}
        style={diagramSide === 'defense' ? { ...activeSegmentStyle, ...buttonFont } : buttonFont}
      >
        Defense
      </button>
    </div>
  );

  const Bar = ({ className = '' }) => (
    <div className={`flex gap-2 items-center ${className}`}>
      <OffenseDefenseSegment />
      <div className="flex-1 min-w-0">
        <StrategySlider
          key={sliderKey}
          side={diagramSide}
          detectedStrategy={detectedStrategy}
          onPresetApplied={handlePresetApplied}
        />
      </div>
    </div>
  );

  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <div className="pb-28 md:pb-0">
        {/* Desktop: bar at top, same row */}
        <div className="hidden md:block max-w-md mb-4">
          <Bar />
        </div>

        <RosterView user={user} diagramSide={diagramSide} refreshTrigger={refreshTrigger} />
      </div>

      {/* Mobile: bar fixed above bottom nav with clearance so buttons aren't cut off by tiles */}
      <div className="md:hidden fixed left-0 right-0 z-40 px-3 safe-area-pb" style={{ bottom: '7.25rem' }}>
        <div className="mx-auto max-w-7xl">
          <Bar />
        </div>
      </div>

    </Layout>
  );
}
