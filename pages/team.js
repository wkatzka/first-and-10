import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import RosterView from '../components/RosterView';

export default function Team({ user, onLogout, unreadMessages }) {
  const router = useRouter();

  const [diagramSide, setDiagramSide] = useState('offense'); // 'offense' | 'defense'

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
  }, [user, router]);

  if (!user) return null;

  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <div className="relative z-10 mb-4">
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

      <RosterView user={user} diagramSide={diagramSide} />
    </Layout>
  );
}

