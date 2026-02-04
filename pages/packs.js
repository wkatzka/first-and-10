import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import PacksContent from '../components/PacksContent';

export default function Packs({ user, onLogout, unreadMessages }) {
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/');
    }
  }, [user, router]);

  if (!user) return null;

  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <PacksContent user={user} />
    </Layout>
  );
}
