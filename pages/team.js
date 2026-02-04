import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import RosterView from '../components/RosterView';
import { autoFillRoster } from '../lib/api';

const NAV_CYAN = '#00e5ff';

export default function Team({ user, onLogout, unreadMessages }) {
  const router = useRouter();
  const [diagramSide, setDiagramSide] = useState('offense');
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
  }, [user, router]);

  const handleStrategySelect = async (strategy) => {
    setSaving(true);
    try {
      await autoFillRoster(strategy);
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
  const tileActiveStyle = { borderColor: NAV_CYAN, boxShadow: `0 0 24px ${NAV_CYAN}40`, color: NAV_CYAN };

  const OffenseDefenseTile = () => (
    <button
      type="button"
      onClick={() => setDiagramSide((s) => (s === 'offense' ? 'defense' : 'offense'))}
      className={`${tileStyle} flex-1 min-w-0 py-3 px-4 touch-target`}
      style={diagramSide === 'offense' ? tileActiveStyle : {}}
    >
      {diagramSide === 'offense' ? 'Offense' : 'Defense'}
    </button>
  );

  const AutoStrategyTile = () => (
    <button
      type="button"
      onClick={() => setShowStrategyModal(true)}
      className={`${tileStyle} flex-1 min-w-0 py-3 px-4 touch-target text-white`}
    >
      Auto Strategy
    </button>
  );

  const Bar = ({ className = '' }) => (
    <div className={`flex gap-2 ${className}`}>
      <OffenseDefenseTile />
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

      {/* Mobile: bar fixed above bottom nav (above the two left tiles) */}
      <div className="md:hidden fixed left-0 right-0 z-40 px-3 safe-area-pb" style={{ bottom: '4.5rem' }}>
        <div className="mx-auto max-w-7xl">
          <Bar />
        </div>
      </div>

      {/* Auto Strategy modal */}
      {showStrategyModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
          onClick={() => !saving && setShowStrategyModal(false)}
        >
          <div
            className="f10-panel p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg f10-title text-white mb-4">Auto-fill by strategy</h3>
            <p className="text-gray-400 text-sm mb-4">
              Pick a strategy to fill your roster with your best matching cards.
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleStrategySelect('pass_heavy')}
                disabled={saving}
                className="w-full py-3 px-4 rounded-xl text-left font-semibold text-white transition-colors disabled:opacity-50"
                style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.22)' }}
              >
                Pass Heavy — Best throwing QB, best WRs & TE
              </button>
              <button
                type="button"
                onClick={() => handleStrategySelect('balanced')}
                disabled={saving}
                className="w-full py-3 px-4 rounded-xl text-left font-semibold text-white transition-colors disabled:opacity-50 bg-white/5 border border-white/10"
              >
                Balanced — Best overall at each position
              </button>
              <button
                type="button"
                onClick={() => handleStrategySelect('run_heavy')}
                disabled={saving}
                className="w-full py-3 px-4 rounded-xl text-left font-semibold text-white transition-colors disabled:opacity-50"
                style={{ background: 'rgba(0,255,127,0.12)', border: '1px solid rgba(0,255,127,0.22)' }}
              >
                Run Heavy — Best mobile QB, best RBs & run game
              </button>
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
