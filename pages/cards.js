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
      <div className="pb-20 md:pb-0">
        {view === 'packs' ? (
          <PacksContent user={user} onViewCollection={() => setViewAndPersist('collection')} />
        ) : (
          <CardsView user={user} />
        )}
      </div>
    </Layout>
  );
}
