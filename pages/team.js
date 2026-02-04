import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import RosterView from '../components/RosterView';
import CardsView from '../components/CardsView';

export default function Team({ user, onLogout, unreadMessages }) {
  const router = useRouter();

  const tabFromQuery = useMemo(() => {
    const t = String(router.query.tab || '').toLowerCase();
    return t === 'cards' ? 'cards' : 'roster';
  }, [router.query.tab]);

  const [tab, setTab] = useState(tabFromQuery);
  const [diagramSide, setDiagramSide] = useState('offense'); // 'offense' | 'defense'

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    setTab(tabFromQuery);
  }, [user, router, tabFromQuery]);

  const setAndPersistTab = (nextTab) => {
    setTab(nextTab);
    router.replace(
      { pathname: '/team', query: nextTab === 'cards' ? { tab: 'cards' } : {} },
      undefined,
      { shallow: true }
    );
  };

  if (!user) return null;

  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      {/* Segmented control */}
      <div className="mb-5">
        <div className="inline-flex f10-segment p-1">
          <button
            onClick={() => setAndPersistTab('roster')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === 'roster' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            My Roster
          </button>
          <button
            onClick={() => setAndPersistTab('cards')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === 'cards' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            My Cards
          </button>
        </div>
      </div>

      {tab === 'roster' && (
        <>
          {/* Offense / Defense dropdown – same aesthetic as segment */}
          <div className="mb-4">
            <label htmlFor="diagram-side" className="sr-only">Play diagram: Offense or Defense</label>
            <select
              id="diagram-side"
              value={diagramSide}
              onChange={(e) => setDiagramSide(e.target.value)}
              className="f10-segment w-full max-w-[200px] px-4 py-2 rounded-lg text-sm font-bold bg-black/30 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              style={{ color: 'inherit' }}
            >
              <option value="offense">Offense</option>
              <option value="defense">Defense</option>
            </select>
          </div>
        </>
      )}

      {tab === 'cards' ? <CardsView user={user} /> : <RosterView user={user} diagramSide={diagramSide} />}
    </Layout>
  );
}

