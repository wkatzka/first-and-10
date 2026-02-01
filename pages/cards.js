import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import CardsView from '../components/CardsView';

export default function Cards({ user, onLogout, unreadMessages }) {
  const router = useRouter();

  if (!user) {
    router.push('/');
    return null;
  }

  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <CardsView user={user} />
    </Layout>
  );
}
