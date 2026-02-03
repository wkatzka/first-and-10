import Link from 'next/link';
import Layout from '../components/Layout';

export default function HowToPlay({ user, onLogout, unreadMessages }) {
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

        {/* Engine Impact Glossary */}
        <section id="engine-impact" className="f10-panel p-6 mb-6">
          <h2 className="text-xl f10-title mb-4" style={{ color: 'var(--nav-cyan)' }}>Engine Impact (What the Bars Mean)</h2>
          <p className="f10-subtitle text-sm mb-4">
            On the back of cards, <strong className="text-white">Engine Impact</strong> shows how that player grades
            versus other players from the same era and position (0–100). Higher is better.
          </p>
          <div className="space-y-4 text-gray-300 text-sm">
            <div>
              <h3 className="text-white font-semibold mb-2">Quarterback (QB)</h3>
              <ul className="space-y-1 ml-4 text-gray-400">
                <li>• <strong className="text-white">Accuracy</strong> — Impact: boosts on-target throws and completion success. Derived from: passing efficiency (yards/attempt proxy) versus era peers.</li>
                <li>• <strong className="text-white">Risk Control</strong> — Impact: fewer drive-killers (INTs). Derived from: interception rate (lower INT/G = higher score), era-adjusted.</li>
                <li>• <strong className="text-white">Mobility</strong> — Impact: more productive scrambles when pressured. Derived from: rushing yards per game versus era QBs.</li>
                <li>• <strong className="text-white">Pass Volume</strong> — Impact: stronger in pass-heavy scripts and benefits more from elite WRs. Derived from: pass attempts per game versus era QBs.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-2">Wide Receiver / Tight End (WR / TE)</h3>
              <ul className="space-y-1 ml-4 text-gray-400">
                <li>• <strong className="text-white">Hands</strong> — Impact: higher catch reliability. Derived from: reception volume per game (usage/reliability proxy) versus era peers.</li>
                <li>• <strong className="text-white">Explosive</strong> — Impact: more chunk gains. Derived from: yards per catch versus era peers.</li>
                <li>• <strong className="text-white">TD Threat</strong> — Impact: more red-zone/finish ability. Derived from: receiving TD rate versus era peers.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-2">Running Back (RB)</h3>
              <ul className="space-y-1 ml-4 text-gray-400">
                <li>• <strong className="text-white">Power Run</strong> — Impact: steadier rushing production. Derived from: rushing yards per game versus era RBs.</li>
                <li>• <strong className="text-white">Breakaway</strong> — Impact: more long runs/chunk plays. Derived from: rushing efficiency (yards/attempt proxy) versus era RBs.</li>
                <li>• <strong className="text-white">Receiving</strong> — Impact: more value on passing downs. Derived from: receiving yards per game versus era RBs.</li>
                <li>• <strong className="text-white">Workhorse</strong> — Impact: sustains drives with consistent touches. Derived from: rushing attempts per game versus era RBs.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-2">Defense (DL / LB / DB)</h3>
              <ul className="space-y-1 ml-4 text-gray-400">
                <li>• <strong className="text-white">Pressure</strong> (DL) — Impact: disrupts QBs and forces worse throws. Derived from: disruption proxy (forced fumbles per game) versus era DL.</li>
                <li>• <strong className="text-white">Run Stop</strong> (DL/LB) — Impact: lowers run efficiency. Derived from: tackles per game versus era defenders (run involvement proxy).</li>
                <li>• <strong className="text-white">Coverage</strong> (LB/DB) — Impact: tighter windows and more incompletions. Derived from: passes defended per game versus era defenders.</li>
                <li>• <strong className="text-white">Ballhawk</strong> (DB) — Impact: more INT chances. Derived from: interceptions per game versus era DB.</li>
                <li>• <strong className="text-white">Tackling</strong> (DB) — Impact: fewer extra yards after contact. Derived from: tackles per game versus era DB.</li>
                <li>• <strong className="text-white">Playmaking</strong> (LB) — Impact: splash moments/turnovers. Derived from: INT rate proxy versus era LBs.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-2">Kicker (K)</h3>
              <ul className="space-y-1 ml-4 text-gray-400">
                <li>• <strong className="text-white">Accuracy</strong> — Impact: more FGs made. Derived from: field goal % versus era kickers.</li>
                <li>• <strong className="text-white">Range</strong> — Impact: more makes from distance. Derived from: field goals made per game (volume proxy) versus era kickers.</li>
                <li>• <strong className="text-white">XP</strong> — Impact: extra point reliability. Derived from: extra points made per game versus era kickers.</li>
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-gray-400">
              <strong className="text-white">Note:</strong> When a specific historical stat is missing, the engine estimates
              that trait using the player’s other available stats versus era peers (so strong “partial” stat profiles can still rate strong).
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
          <div className="text-center">
            <Link
              href="/packs"
              className="inline-block px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all"
            >
              Open Your Packs
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
