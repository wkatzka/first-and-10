import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { logout } from '../lib/api';

export default function HowToPlay({ user, onLogout, unreadMessages }) {
  const router = useRouter();
  const handleLogout = async () => {
    await logout();
    if (onLogout) onLogout();
    router.push('/');
  };
  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl f10-title text-white mb-6 text-center">How to Play</h1>
        
        {/* Quick Start */}
        <section className="f10-panel p-6 mb-6">
          <h2 className="text-xl f10-title mb-4" style={{ color: 'var(--nav-yellow)' }}>Quick Start</h2>
          <ol className="space-y-3 text-gray-300">
            <li className="flex gap-3">
              <span className="text-yellow-400 font-bold">1.</span>
              <span><strong className="text-white">Open Packs</strong> — Get your free starter cards</span>
            </li>
            <li className="flex gap-3">
              <span className="text-yellow-400 font-bold">2.</span>
              <span><strong className="text-white">Build Roster</strong> — Fill 11 starting positions</span>
            </li>
            <li className="flex gap-3">
              <span className="text-yellow-400 font-bold">3.</span>
              <span><strong className="text-white">Compete</strong> — Games auto-play at 7 PM & 9 PM EST</span>
            </li>
          </ol>
        </section>
        
        {/* Card Tiers */}
        <section className="f10-panel p-6 mb-6">
          <h2 className="text-xl f10-title mb-4" style={{ color: 'var(--nav-purple)' }}>Card Tiers</h2>
          <p className="f10-subtitle mb-4">Higher tier = better stats = more points in games</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{color: '#EAB308'}}>★ Legendary</span>
              <span className="text-gray-400">Top 3%</span>
            </div>
            <div className="flex justify-between p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{color: '#F97316'}}>★ Epic</span>
              <span className="text-gray-400">Top 5%</span>
            </div>
            <div className="flex justify-between p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{color: '#EC4899'}}>Ultra Rare</span>
              <span className="text-gray-400">Top 10%</span>
            </div>
            <div className="flex justify-between p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{color: '#A855F7'}}>Very Rare</span>
              <span className="text-gray-400">Top 15%</span>
            </div>
            <div className="flex justify-between p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{color: '#8B5CF6'}}>Rare</span>
              <span className="text-gray-400">Top 25%</span>
            </div>
            <div className="flex justify-between p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-gray-400">Common</span>
              <span className="text-gray-400">Rest</span>
            </div>
          </div>
        </section>
        
        {/* Roster Strategy */}
        <section className="f10-panel p-6 mb-6">
          <h2 className="text-xl f10-title mb-4" style={{ color: 'var(--nav-cyan)' }}>Roster Strategy</h2>
          <div className="space-y-4 text-gray-300">
            <div>
              <h3 className="text-white font-semibold mb-1">11 Starting Positions</h3>
              <p className="text-sm text-gray-400">QB, RB, WR×2, TE, OL, DL, LB, DB×2, K</p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1">Position Matchups Matter</h3>
              <ul className="text-sm text-gray-400 space-y-1 ml-4">
                <li>• Your <strong className="text-red-400">QB</strong> vs their <strong className="text-orange-400">DL</strong> — Can you avoid the rush?</li>
                <li>• Your <strong className="text-blue-400">WR</strong> vs their <strong className="text-cyan-400">DB</strong> — Who wins the routes?</li>
                <li>• Your <strong className="text-green-400">RB</strong> vs their <strong className="text-pink-400">LB</strong> — Ground game or stuffed?</li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1">Balance Your Roster</h3>
              <p className="text-sm text-gray-400">Don't stack all offense — a weak defense loses games!</p>
            </div>
          </div>
        </section>
        
        {/* Game Simulation */}
        <section className="f10-panel p-6 mb-6">
          <h2 className="text-xl f10-title mb-4" style={{ color: 'var(--nav-green)' }}>How Games Work</h2>
          <div className="space-y-3 text-gray-300 text-sm">
            <p>Games simulate a full football match using your roster's stats:</p>
            <ul className="space-y-2 ml-4">
              <li>• <strong className="text-white">Play-by-play simulation</strong> — Each drive is calculated</li>
              <li>• <strong className="text-white">Stats matter</strong> — Historical player performance drives results</li>
              <li>• <strong className="text-white">Some randomness</strong> — Upsets can happen!</li>
              <li>• <strong className="text-white">No user input needed</strong> — Games auto-play with your current roster</li>
            </ul>
          </div>
        </section>

        {/* Player Attributes & Matchups */}
        <section id="matchups" className="f10-panel p-6 mb-6">
          <h2 className="text-xl f10-title mb-4" style={{ color: 'var(--nav-cyan)' }}>Player Attributes & Matchups</h2>
          <p className="f10-subtitle text-sm mb-4">
            Every player has <strong className="text-white">3 key attributes</strong> (0–100) that determine how they perform.
            Compare your players attributes against opponents to make strategic roster decisions.
          </p>
          
          {/* How to Read Matchups */}
          <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.18)' }}>
            <div className="font-semibold text-white mb-2">How Matchups Work</div>
            <p className="text-sm text-gray-300">
              When your offense faces their defense, compare the relevant attributes:
            </p>
            <ul className="text-sm text-gray-400 mt-2 space-y-1">
              <li>• <span className="text-blue-400">Your WR Separation</span> vs <span className="text-orange-400">Their DB Coverage</span> — Who wins routes?</li>
              <li>• <span className="text-green-400">Your RB Power</span> vs <span className="text-pink-400">Their LB Run D</span> — Can you run up the middle?</li>
              <li>• <span className="text-red-400">Your QB Arm</span> vs <span className="text-purple-400">Their DB Ball Skills</span> — Risk of interceptions?</li>
            </ul>
          </div>

          <div className="space-y-4 text-gray-300 text-sm">
            <div>
              <h3 className="text-white font-semibold mb-2">Offense</h3>
              <div className="space-y-3 ml-2">
                <div>
                  <div className="text-cyan-400 font-medium">QB — Quarterback</div>
                  <ul className="text-gray-400 text-xs space-y-0.5 mt-1">
                    <li><strong className="text-white">Arm</strong> — Accuracy & deep ball. Countered by DB Coverage.</li>
                    <li><strong className="text-white">Legs</strong> — Mobility & scramble. Countered by DL Contain.</li>
                    <li><strong className="text-white">Poise</strong> — Decisions under pressure. Reduces INT risk vs Ball Skills.</li>
                  </ul>
                </div>
                <div>
                  <div className="text-cyan-400 font-medium">RB — Running Back</div>
                  <ul className="text-gray-400 text-xs space-y-0.5 mt-1">
                    <li><strong className="text-white">Power</strong> — Between the tackles. Countered by LB Run D.</li>
                    <li><strong className="text-white">Speed</strong> — Outside runs & breakaway. Countered by DL Contain.</li>
                    <li><strong className="text-white">Hands</strong> — Receiving ability. Countered by LB Pass D.</li>
                  </ul>
                </div>
                <div>
                  <div className="text-cyan-400 font-medium">WR — Wide Receiver</div>
                  <ul className="text-gray-400 text-xs space-y-0.5 mt-1">
                    <li><strong className="text-white">Separation</strong> — Gets open vs coverage. Countered by DB Coverage.</li>
                    <li><strong className="text-white">Catch</strong> — Contested catch ability. Countered by DB Ball Skills.</li>
                    <li><strong className="text-white">YAC</strong> — Yards after catch. Countered by DB Tackling.</li>
                  </ul>
                </div>
                <div>
                  <div className="text-cyan-400 font-medium">TE — Tight End</div>
                  <ul className="text-gray-400 text-xs space-y-0.5 mt-1">
                    <li><strong className="text-white">Catch</strong> — Receiving ability. Countered by LB Pass D.</li>
                    <li><strong className="text-white">Block</strong> — Run/pass protection. Helps RB Power & QB Poise.</li>
                    <li><strong className="text-white">YAC</strong> — After catch yards. Countered by LB Run D.</li>
                  </ul>
                </div>
                <div>
                  <div className="text-cyan-400 font-medium">OL — Offensive Line</div>
                  <ul className="text-gray-400 text-xs space-y-0.5 mt-1">
                    <li><strong className="text-white">Pass Pro</strong> — Protects QB from rush. Countered by DL Pass Rush.</li>
                    <li><strong className="text-white">Run Block</strong> — Opens holes for RB. Countered by DL Run Stuff.</li>
                    <li><strong className="text-white">Anchor</strong> — Holds vs power moves. Countered by DL Pass Rush.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-2">Defense</h3>
              <div className="space-y-3 ml-2">
                <div>
                  <div className="text-orange-400 font-medium">DL — Defensive Line</div>
                  <ul className="text-gray-400 text-xs space-y-0.5 mt-1">
                    <li><strong className="text-white">Pass Rush</strong> — Pressure on QB. Counters OL Pass Pro & Anchor.</li>
                    <li><strong className="text-white">Run Stuff</strong> — Stops RB at line. Counters OL Run Block.</li>
                    <li><strong className="text-white">Contain</strong> — Controls the edge. Counters QB Legs & RB Speed.</li>
                  </ul>
                </div>
                <div>
                  <div className="text-orange-400 font-medium">LB — Linebacker</div>
                  <ul className="text-gray-400 text-xs space-y-0.5 mt-1">
                    <li><strong className="text-white">Run D</strong> — Tackles RB in box. Counters RB Power & TE YAC.</li>
                    <li><strong className="text-white">Pass D</strong> — Covers TE/RB. Counters TE Catch & RB Hands.</li>
                    <li><strong className="text-white">Blitz</strong> — Rushing the QB. Adds pressure, counters OL.</li>
                  </ul>
                </div>
                <div>
                  <div className="text-orange-400 font-medium">DB — Defensive Back</div>
                  <ul className="text-gray-400 text-xs space-y-0.5 mt-1">
                    <li><strong className="text-white">Coverage</strong> — Shadows WR routes. Counters WR Separation & QB Arm.</li>
                    <li><strong className="text-white">Ball Skills</strong> — Intercepts passes. Counters WR Catch & risky throws.</li>
                    <li><strong className="text-white">Tackling</strong> — Limits YAC. Counters WR YAC after catch.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-2">Special Teams</h3>
              <div className="ml-2">
                <div className="text-yellow-400 font-medium">K — Kicker</div>
                <ul className="text-gray-400 text-xs space-y-0.5 mt-1">
                  <li><strong className="text-white">Accuracy</strong> — FG percentage. Higher = more made kicks.</li>
                  <li><strong className="text-white">Range</strong> — Distance capability. Enables long FG attempts.</li>
                  <li><strong className="text-white">Clutch</strong> — Pressure kicks. Matters in close games.</li>
                </ul>
              </div>
            </div>

            {/* Strategy Connection */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="font-semibold text-white mb-2">Strategy Tips</div>
              <ul className="text-gray-400 text-xs space-y-1">
                <li>🎯 <strong className="text-white">Pass Heavy:</strong> Prioritize QB Arm, WR Separation, OL Pass Pro</li>
                <li>🏃 <strong className="text-white">Run Heavy:</strong> Prioritize RB Power/Speed, OL Run Block, TE Block</li>
                <li>⚖️ <strong className="text-white">Balanced:</strong> Look for versatile players with even attributes</li>
              </ul>
            </div>
          </div>
        </section>
        
        {/* Schedule */}
        <section className="f10-panel p-6 mb-6">
          <h2 className="text-xl f10-title mb-4" style={{ color: 'var(--nav-yellow)' }}>Game Schedule</h2>
          <div className="space-y-3 text-gray-300">
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,230,0,0.08)', border: '1px solid rgba(255,230,0,0.18)' }}>
              <span className="text-2xl">📅</span>
              <div>
                <p className="font-semibold text-white">Games: Monday – Sunday</p>
                <p className="text-sm text-gray-400">2 games per day at 7 PM & 9 PM EST</p>
              </div>
            </div>
            <p className="text-sm text-gray-400">
              Schedule posted one day in advance. Check the Schedule tab to see your matchups!
            </p>
          </div>
        </section>
        
        {/* Unique Cards */}
        <section className="f10-panel p-6 mb-6">
          <h2 className="text-xl f10-title mb-4" style={{ color: 'var(--nav-pink)' }}>Unique Cards (1-of-1)</h2>
          <div className="space-y-3 text-gray-300">
            <p>Every card in First & 10 is <strong className="text-white">completely unique</strong>.</p>
            <p className="text-sm text-gray-400">
              There's only ONE 2007 Tom Brady, ONE 1985 Jerry Rice, etc. Once a card is minted, 
              no one else can get it. This makes your collection truly yours!
            </p>
          </div>
        </section>
        
        {/* Tips */}
        <section className="f10-panel p-6 mb-6" style={{ borderColor: 'rgba(168,85,247,0.22)' }}>
          <h2 className="text-xl f10-title text-white mb-4">Pro Tips</h2>
          <ul className="space-y-2 text-gray-300 text-sm">
            <li>✓ Open all your packs first to see what you have</li>
            <li>✓ Use Auto-Fill to quickly set your best roster</li>
            <li>✓ Check for Legendary/Epic pulls — they're game-changers</li>
            <li>✓ Update your roster before 7 PM EST if you want changes</li>
            <li>✓ Use Press Conference to chat with opponents after games</li>
          </ul>
        </section>
        
        {/* CTA */}
        {!user ? (
          <div className="text-center">
            <Link
              href="/"
              className="inline-block px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all"
            >
              Get Started
            </Link>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <Link
              href="/cards"
              className="inline-block px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all"
            >
              Open Your Packs
            </Link>
            <div>
              <button
                type="button"
                onClick={handleLogout}
                className="px-6 py-2 text-sm text-gray-400 hover:text-white transition-colors touch-target"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
