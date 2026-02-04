import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import RosterView from '../components/RosterView';
import { autoFillRoster } from '../lib/api';

const NAV_CYAN = '#00e5ff';

const OFFENSE_STRATEGIES = [
  { value: 'pass_heavy', label: 'Pass Heavy', description: 'Best throwing QB, best WRs & TE' },
  { value: 'balanced', label: 'Balanced', description: 'Best overall at each position' },
  { value: 'run_heavy', label: 'Run Dominant', description: 'Best mobile QB, best RBs & run game' },
];

const DEFENSE_STRATEGIES = [
  { value: 'coverage_shell', label: 'Coverage Shell', description: 'Nickel/Dime — best vs pass' },
  { value: 'run_stuff', label: 'Run Stuff', description: 'Stacked box — best vs run' },
  { value: 'base_defense', label: 'Base Defense', description: '4-3/3-4 — balanced' },
];

function loadStored(key, valid) {
  if (typeof window === 'undefined') return null;
  try {
    const s = localStorage.getItem(key);
    return s && valid.includes(s) ? s : null;
  } catch (_) {
    return null;
  }
}

export default function Team({ user, onLogout, unreadMessages }) {
  const router = useRouter();
  const [diagramSide, setDiagramSide] = useState('offense');
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [selectedOffenseStrategy, setSelectedOffenseStrategy] = useState(() =>
    loadStored('f10_auto_strategy_offense', ['pass_heavy', 'balanced', 'run_heavy'])
  );
  const [selectedDefenseStrategy, setSelectedDefenseStrategy] = useState(() =>
    loadStored('f10_auto_strategy_defense', ['coverage_shell', 'run_stuff', 'base_defense'])
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (selectedOffenseStrategy) localStorage.setItem('f10_auto_strategy_offense', selectedOffenseStrategy);
      if (selectedDefenseStrategy) localStorage.setItem('f10_auto_strategy_defense', selectedDefenseStrategy);
    } catch (_) {}
  }, [selectedOffenseStrategy, selectedDefenseStrategy]);

  const handleStrategySelect = async (value) => {
    setSaving(true);
    try {
      const offense = diagramSide === 'offense' ? value : (selectedOffenseStrategy || 'balanced');
      const defense = diagramSide === 'defense' ? value : (selectedDefenseStrategy || 'base_defense');
      await autoFillRoster(offense, defense);
      if (diagramSide === 'offense') setSelectedOffenseStrategy(value);
      else setSelectedDefenseStrategy(value);
      setRefreshTrigger((t) => t + 1);
      setShowStrategyModal(false);
    } catch (err) {
      console.error('Auto-fill failed:', err);
      alert(err.message || 'Failed to auto-fill roster');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const tileStyle = 'bg-black/30 backdrop-blur border border-white/10 rounded-2xl flex items-center justify-center font-bold text-sm transition-colors';

  const activeSegmentStyle = { backgroundColor: `${NAV_CYAN}20`, border: `2px solid ${NAV_CYAN}`, boxShadow: `0 0 12px ${NAV_CYAN}80` };
  const OffenseDefenseSegment = () => (
    <div className="flex p-1 bg-black/30 backdrop-blur border border-white/10 rounded-2xl shadow-lg">
      <button
        type="button"
        onClick={() => setDiagramSide('offense')}
        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
          diagramSide === 'offense' ? 'text-white' : 'text-gray-400 hover:text-white'
        }`}
        style={diagramSide === 'offense' ? activeSegmentStyle : {}}
      >
        Offense
      </button>
      <button
        type="button"
        onClick={() => setDiagramSide('defense')}
        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
          diagramSide === 'defense' ? 'text-white' : 'text-gray-400 hover:text-white'
        }`}
        style={diagramSide === 'defense' ? activeSegmentStyle : {}}
      >
        Defense
      </button>
    </div>
  );

  const strategies = diagramSide === 'offense' ? OFFENSE_STRATEGIES : DEFENSE_STRATEGIES;
  const selected = diagramSide === 'offense' ? selectedOffenseStrategy : selectedDefenseStrategy;
  const strategyLabel = selected
    ? (strategies.find((s) => s.value === selected)?.label ?? 'Auto Strategy')
    : 'Auto Strategy';
  const AutoStrategyTile = () => (
    <button
      type="button"
      onClick={() => setShowStrategyModal(true)}
      className={`${tileStyle} flex-1 min-w-0 py-3 px-4 touch-target text-white`}
    >
      {strategyLabel}
    </button>
  );

  const Bar = ({ className = '' }) => (
    <div className={`flex gap-2 items-center ${className}`}>
      <OffenseDefenseSegment />
      <AutoStrategyTile />
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

      {/* Strategy modal: content depends on Offense vs Defense tab; selection runs autofill and button shows name */}
      {showStrategyModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          onClick={() => !saving && setShowStrategyModal(false)}
        >
          <div
            className="f10-panel p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg f10-title text-white mb-4">
              {diagramSide === 'offense' ? 'Offense strategy' : 'Defense strategy'}
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              {diagramSide === 'offense'
                ? 'Pick a strategy to fill offensive slots with your best matching cards.'
                : 'Pick a strategy to fill defensive slots with your best matching cards.'}
            </p>
            <div className="space-y-2">
              {strategies.map((s) => {
                const isSelected = selected === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => handleStrategySelect(s.value)}
                    disabled={saving}
                    className="w-full py-3 px-4 rounded-xl text-left font-semibold text-white transition-colors disabled:opacity-50"
                    style={
                      isSelected
                        ? { backgroundColor: `${NAV_CYAN}20`, border: `2px solid ${NAV_CYAN}`, boxShadow: `0 0 12px ${NAV_CYAN}80` }
                        : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }
                    }
                  >
                    {s.label} — {s.description}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => !saving && setShowStrategyModal(false)}
              className="mt-4 w-full py-2 text-gray-400 hover:text-white text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
