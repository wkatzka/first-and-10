import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import CardsView from '../components/CardsView';

export default function Cards({ user, onLogout, unreadMessages }) {
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/');
    }
  }, [user, router]);

  if (!user) return null;

  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <CardsView user={user} />
    </Layout>
  );
}
