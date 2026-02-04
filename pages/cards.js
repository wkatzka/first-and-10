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
      <div className="pb-36 md:pb-0">
        {view === 'packs' ? (
          <PacksContent user={user} onViewCollection={() => setViewAndPersist('collection')} />
        ) : (
          <CardsView user={user} />
        )}
      </div>

      {/* Packs | My cards bar – above bottom nav, same tile aesthetic, active = red glow */}
      <div className="md:hidden fixed left-0 right-0 z-40 px-3 safe-area-pb" style={{ bottom: '6rem' }}>
        <div className="mx-auto max-w-7xl flex justify-center">
          <div className="flex p-1 bg-black/30 backdrop-blur border border-white/10 rounded-2xl shadow-lg">
            <button
              onClick={() => setViewAndPersist('packs')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                view === 'packs'
                  ? 'text-white bg-red-500/20 ring-2 ring-red-400 shadow-[0_0_12px_rgba(248,113,113,0.5)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Packs
            </button>
            <button
              onClick={() => setViewAndPersist('collection')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                view === 'collection'
                  ? 'text-white bg-red-500/20 ring-2 ring-red-400 shadow-[0_0_12px_rgba(248,113,113,0.5)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              My cards
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
