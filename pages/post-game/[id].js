import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { getGame } from '../../lib/api';

function isScoringPlay(play) {
  const t = String(play?.type || '').toLowerCase();
  const r = String(play?.result || '').toLowerCase();
  const d = String(play?.description || '').toLowerCase();
  return (
    t === 'field_goal' ||
    t === 'extra_point' ||
    r === 'touchdown' ||
    d.includes('touchdown') ||
    d.includes('field goal') ||
    d.includes('extra point') ||
    d.includes('safety')
  );
}

function playBadge(play) {
  const t = String(play?.type || '').toLowerCase();
  const r = String(play?.result || '').toLowerCase();
  if (r === 'touchdown') return { label: 'TD', cls: 'bg-green-600/30 border-green-500/40 text-green-200' };
  if (t === 'field_goal') return { label: 'FG', cls: 'bg-yellow-600/20 border-yellow-500/40 text-yellow-200' };
  if (t === 'extra_point') return { label: 'XP', cls: 'bg-yellow-600/20 border-yellow-500/40 text-yellow-200' };
  if (r === 'interception') return { label: 'INT', cls: 'bg-orange-600/20 border-orange-500/40 text-orange-200' };
  if (r === 'fumble') return { label: 'FUM', cls: 'bg-orange-600/20 border-orange-500/40 text-orange-200' };
  if (r === 'sack') return { label: 'SACK', cls: 'bg-blue-600/20 border-blue-500/40 text-blue-200' };
  return null;
}

export default function PostGameReport({ user, onLogout, unreadMessages }) {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getGame(id);
        if (!cancelled) setGame(data.game || null);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load game');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const plays = game?.play_by_play || [];

  const playsByQuarter = useMemo(() => {
    const map = new Map();
    for (const p of plays) {
      const q = Number(p?.quarter || 0) || 0;
      if (!map.has(q)) map.set(q, []);
      map.get(q).push(p);
    }
    // Keep quarters in order
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [plays]);

  if (!user) return null;

  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl f10-title text-white">Post-Game Report</h1>
            <p className="f10-subtitle">
              {game?.home_username || 'Home'} vs {game?.away_username || 'Away'}
              {game?.played_at ? ` · ${new Date(game.played_at).toLocaleString()}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded-xl text-sm text-gray-200 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            Back
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading report...</div>
        ) : error ? (
          <div className="f10-panel p-4 border border-red-500/30">
            <div className="text-red-300 font-semibold mb-1">Couldn’t load report</div>
            <div className="text-sm text-gray-300">{error}</div>
          </div>
        ) : !game ? (
          <div className="text-center text-gray-400 py-12">Game not found.</div>
        ) : (
          <>
            {/* Score header */}
            <div className="f10-panel p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm text-gray-400">Home</div>
                  <div className="text-lg font-bold text-white truncate">{game.home_username || 'Home'}</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-white">
                    <span className="text-white">{game.home_score}</span>
                    <span className="text-gray-500 mx-3">-</span>
                    <span className="text-white">{game.away_score}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Final</div>
                </div>
                <div className="min-w-0 text-right">
                  <div className="text-sm text-gray-400">Away</div>
                  <div className="text-lg font-bold text-white truncate">{game.away_username || 'Away'}</div>
                </div>
              </div>
            </div>

            {/* Play-by-play */}
            <div className="f10-panel p-5">
              <h2 className="text-xl f10-title text-white mb-3">Play-by-Play</h2>

              {plays.length === 0 ? (
                <div className="text-gray-400 text-sm">
                  No play-by-play recorded for this game (forfeit or legacy game).
                </div>
              ) : (
                <div className="space-y-5">
                  {playsByQuarter.map(([quarter, qPlays]) => (
                    <div key={quarter} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-white">
                          {quarter > 0 ? `Q${quarter}` : 'Game'}
                        </div>
                        <div className="text-xs text-gray-500">{qPlays.length} plays</div>
                      </div>

                      <div className="space-y-2">
                        {qPlays.map((p) => {
                          const badge = playBadge(p);
                          const highlight = isScoringPlay(p);
                          const key = `${p.playNumber || ''}-${p.time || ''}-${p.description || ''}`;

                          return (
                            <div
                              key={key}
                              className={`rounded-xl p-3 border ${
                                highlight ? 'bg-white/5 border-white/15' : 'bg-black/20 border-white/10'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-gray-400">
                                      {p.time ? p.time : ''}
                                      {typeof p.down === 'number' && typeof p.yardsToGo === 'number'
                                        ? ` · ${p.down}&${p.yardsToGo}`
                                        : ''}
                                    </span>
                                    {badge && (
                                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badge.cls}`}>
                                        {badge.label}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-200 break-words">
                                    {p.description || `${p.type || 'play'} (${p.result || 'result'})`}
                                  </div>
                                  <div className="text-[11px] text-gray-500 mt-1">
                                    {p.possession ? `Poss: ${p.possession}` : ''}
                                    {typeof p.fieldPosition === 'number' ? ` · Ball: ${p.fieldPosition}` : ''}
                                    {typeof p.yards === 'number' ? ` · Yds: ${p.yards}` : ''}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

