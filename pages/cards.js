import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import CardsView from '../components/CardsView';
import PacksContent from '../components/PacksContent';

export default function Cards({ user, onLogout, unreadMessages }) {
  const router = useRouter();
  const viewFromQuery = router.query.view === 'collection' ? 'collection' : 'packs';
  const [view, setView] = useState(viewFromQuery);

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    setView(viewFromQuery);
  }, [user, router, viewFromQuery]);

  const setViewAndPersist = (nextView) => {
    setView(nextView);
    router.replace(
      { pathname: '/cards', query: nextView === 'collection' ? { view: 'collection' } : {} },
      undefined,
      { shallow: true }
    );
  };

  if (!user) return null;

  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <div className="pb-32 md:pb-0">
        {view === 'packs' ? (
          <PacksContent user={user} onViewCollection={() => setViewAndPersist('collection')} />
        ) : (
          <CardsView user={user} />
        )}
      </div>

      {/* Packs | Collection bar – above bottom nav on mobile */}
      <div className="md:hidden fixed left-0 right-0 z-40 px-3 safe-area-pb" style={{ bottom: '4.5rem' }}>
        <div className="mx-auto max-w-7xl">
          <div className="inline-flex f10-segment p-1 bg-black/30 backdrop-blur border border-white/10 rounded-xl">
            <button
              onClick={() => setViewAndPersist('packs')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                view === 'packs' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Packs
            </button>
            <button
              onClick={() => setViewAndPersist('collection')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                view === 'collection' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Collection
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
