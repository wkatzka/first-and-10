import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import RosterView from '../components/RosterView';

export default function Roster({ user, onLogout, unreadMessages }) {
  const router = useRouter();

  if (!user) {
    router.push('/');
    return null;
  }

  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <RosterView user={user} />
    </Layout>
  );
}
