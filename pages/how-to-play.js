import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { logout } from '../lib/api';

// Tab configuration with tile aesthetic colors
const TABS = [
  { id: 'strategy', label: 'Strategy', color: '#00e5ff' },
  { id: 'cards', label: 'Cards', color: '#a855f7' },
  { id: 'gameplay', label: 'Gameplay', color: '#4ade80' },
];

// Tab icons matching the tile aesthetic
const TabIcons = {
  strategy: (stroke) => (
    <svg viewBox="0 0 32 32" className="w-5 h-5">
      <path d="M6 16 L16 6 L26 16 L16 26 Z" stroke={stroke} strokeWidth="2.5" fill="none" />
    </svg>
  ),
  cards: (stroke) => (
    <svg viewBox="0 0 32 32" className="w-5 h-5">
      <rect x="8" y="6" width="16" height="20" rx="2" stroke={stroke} strokeWidth="2.5" fill="none" />
    </svg>
  ),
  gameplay: (stroke) => (
    <svg viewBox="0 0 32 32" className="w-5 h-5">
      <circle cx="16" cy="16" r="10" stroke={stroke} strokeWidth="2.5" fill="none" />
      <path d="M13 12 L21 16 L13 20 Z" fill={stroke} />
    </svg>
  ),
};

// Strategy matchup outcomes table data
const MATCHUP_TABLE = {
  offense: ['Run Heavy', 'Balanced', 'Pass Heavy'],
  defense: ['Run Stuff', 'Base', 'Coverage'],
  // Outcomes from OFFENSE perspective: offense row vs defense column
  // 2 = strong advantage, 1 = advantage, 0 = neutral, -1 = disadvantage, -2 = strong disadvantage
  outcomes: [
    [-2, 0, 2],  // Run Heavy vs [Run Stuff (bad), Base (even), Coverage (good)]
    [0, 0, 0],   // Balanced vs [Run Stuff, Base, Coverage] - always neutral
    [2, 0, -2],  // Pass Heavy vs [Run Stuff (good), Base (even), Coverage (bad)]
  ],
};

const getOutcomeStyle = (value) => {
  if (value >= 2) return { bg: 'rgba(74, 222, 128, 0.25)', text: '#4ade80', label: 'Strong' };
  if (value === 1) return { bg: 'rgba(74, 222, 128, 0.15)', text: '#86efac', label: 'Good' };
  if (value === 0) return { bg: 'rgba(163, 163, 163, 0.15)', text: '#a3a3a3', label: 'Even' };
  if (value === -1) return { bg: 'rgba(248, 113, 113, 0.15)', text: '#f87171', label: 'Weak' };
  return { bg: 'rgba(248, 113, 113, 0.25)', text: '#ef4444', label: 'Countered' };
};

// Collapsible section component
function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition-colors"
      >
        <span className="font-semibold text-white" style={{ fontFamily: 'var(--f10-display-font)' }}>
          {title}
        </span>
        <svg 
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="p-4 border-t border-white/10">
          {children}
        </div>
      )}
    </div>
  );
}

// Strategy Tab Content
function StrategyTab() {
  return (
    <div className="space-y-6">
      {/* Strategy vs Strategy Table */}
      <section>
        <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: 'var(--f10-display-font)' }}>
          Strategy Matchups
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Your offensive strategy vs their defensive strategy determines your advantage.
        </p>
        
        {/* Matchup Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left text-gray-500 text-xs">YOUR OFFENSE</th>
                {MATCHUP_TABLE.defense.map(def => (
                  <th key={def} className="p-2 text-center text-orange-400 text-xs font-medium">
                    {def}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATCHUP_TABLE.offense.map((off, i) => (
                <tr key={off}>
                  <td className="p-2 text-cyan-400 font-medium text-xs">{off}</td>
                  {MATCHUP_TABLE.outcomes[i].map((outcome, j) => {
                    const style = getOutcomeStyle(outcome);
                    return (
                      <td key={j} className="p-1">
                        <div 
                          className="rounded-lg p-2 text-center text-xs font-semibold"
                          style={{ backgroundColor: style.bg, color: style.text }}
                        >
                          {style.label}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <p className="text-xs text-gray-500 mt-3">
          Counter their strategy: Run Heavy beats Coverage, Pass Heavy beats Run Stuff. Getting countered is bad!
        </p>
      </section>

      {/* Strategy Slider Explained */}
      <section className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }}>
        <h3 className="text-white font-semibold mb-2" style={{ fontFamily: 'var(--f10-display-font)' }}>
          The Strategy Slider
        </h3>
        <div className="space-y-2 text-sm text-gray-300">
          <p><strong className="text-cyan-400">Dots</strong> = Different roster configurations your cards can make</p>
          <p><strong className="text-cyan-400">Position</strong> = Where that build falls on the run/pass spectrum</p>
          <p><strong className="text-cyan-400">Drag or tap</strong> = Preview and apply different builds instantly</p>
        </div>
        <div className="mt-3 p-2 rounded-lg bg-black/30 text-xs text-gray-400">
          The slider shows all valid rosters within your tier cap. Dots closer to the left are more run-heavy, dots on the right are more pass-heavy.
        </div>
      </section>

      {/* Opponent Scouting */}
      <section className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
        <h3 className="text-white font-semibold mb-2" style={{ fontFamily: 'var(--f10-display-font)' }}>
          Opponent Scouting
        </h3>
        <div className="space-y-2 text-sm text-gray-300">
          <p>On the <strong className="text-purple-400">My Team</strong> page, use the Game 1 / Game 2 buttons to scout opponents.</p>
          <p>When viewing your offense, you'll see your opponent's possible <strong className="text-purple-400">defensive</strong> builds above.</p>
          <p>Use their slider to preview what strategies they might use - then counter accordingly!</p>
        </div>
        <div className="mt-3 p-2 rounded-lg bg-black/30 text-xs text-gray-400">
          Note: Scouting shows possible builds, not their actual roster. Their slider doesn't change their team.
        </div>
      </section>

      {/* Tier Caps */}
      <section>
        <h3 className="text-white font-semibold mb-3" style={{ fontFamily: 'var(--f10-display-font)' }}>
          Tier Caps
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl text-center" style={{ backgroundColor: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.2)' }}>
            <div className="text-2xl font-bold text-cyan-400">42</div>
            <div className="text-xs text-gray-400">Offense Cap</div>
            <div className="text-xs text-gray-500 mt-1">6 positions</div>
          </div>
          <div className="p-3 rounded-xl text-center" style={{ backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}>
            <div className="text-2xl font-bold text-red-400">28</div>
            <div className="text-xs text-gray-400">Defense Cap</div>
            <div className="text-xs text-gray-500 mt-1">4 positions</div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Your total card tiers can't exceed the cap. This prevents stacking all legendary cards and keeps games competitive.
        </p>
      </section>
    </div>
  );
}

// Cards Tab Content
function CardsTab() {
  return (
    <div className="space-y-6">
      {/* Tier System */}
      <section>
        <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: 'var(--f10-display-font)' }}>
          Card Tiers
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Higher tier = better stats = more impact in games
        </p>
        <div className="space-y-1.5">
          {[
            { name: 'Hall of Fame', color: '#FFD700', tier: 'T11', pct: '0.5%', bg: 'linear-gradient(90deg, rgba(255,0,0,0.08), rgba(255,127,0,0.08), rgba(255,255,0,0.08), rgba(0,255,0,0.08), rgba(0,0,255,0.08), rgba(148,0,211,0.08))' },
            { name: 'Legendary', color: '#EAB308', tier: 'T10', pct: '1.0%' },
            { name: 'Epic', color: '#F97316', tier: 'T9', pct: '3.0%' },
            { name: 'Ultra Rare', color: '#EC4899', tier: 'T8', pct: '7.0%' },
            { name: 'Very Rare', color: '#A855F7', tier: 'T7', pct: '12.0%' },
            { name: 'Rare', color: '#8B5CF6', tier: 'T6', pct: '18.0%' },
            { name: 'Uncommon+', color: '#6B8AE0', tier: 'T5', pct: '22.0%' },
            { name: 'Uncommon', color: '#60A5FA', tier: 'T4', pct: '20.0%' },
            { name: 'Common+', color: '#9CA3AF', tier: 'T3', pct: '10.0%' },
            { name: 'Common', color: '#6b7280', tier: 'T2', pct: '5.0%' },
            { name: 'Basic', color: '#4b5563', tier: 'T1', pct: '2.0%' },
          ].map(tier => (
            <div 
              key={tier.name}
              className="flex items-center justify-between p-2 rounded-xl"
              style={{ 
                background: tier.bg || 'rgba(255,255,255,0.05)',
                border: `1px solid ${tier.color}22`,
              }}
            >
              <div className="flex items-center gap-2">
                <span 
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${tier.color}30`, color: tier.color }}
                >
                  {tier.tier}
                </span>
                <span style={{ color: tier.color }} className="font-semibold text-sm">{tier.name}</span>
              </div>
              <span className="text-gray-400 text-xs font-medium">{tier.pct}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Unique Cards */}
      <section className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
        <h3 className="text-white font-semibold mb-2" style={{ fontFamily: 'var(--f10-display-font)' }}>
          1-of-1 Cards
        </h3>
        <p className="text-sm text-gray-300">
          Every card is <strong className="text-purple-400">completely unique</strong>. There's only ONE 2007 Tom Brady, ONE 1985 Jerry Rice, etc.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Once a card is minted, no one else can get it. Your collection is truly yours.
        </p>
      </section>

      {/* Player Attributes - Collapsible */}
      <CollapsibleSection title="Player Attributes">
        <div className="space-y-4 text-sm">
          {/* Offense */}
          <div>
            <h4 className="text-cyan-400 font-semibold mb-2">Offense</h4>
            <div className="space-y-2 text-gray-400 text-xs">
              <div><strong className="text-white">QB:</strong> Arm (accuracy), Legs (mobility), Poise (decisions)</div>
              <div><strong className="text-white">RB:</strong> Power (inside runs), Speed (outside), Hands (receiving)</div>
              <div><strong className="text-white">WR:</strong> Separation (routes), Catch (contested), YAC (after catch)</div>
              <div><strong className="text-white">TE:</strong> Catch, Block, YAC</div>
              <div><strong className="text-white">OL:</strong> Pass Pro, Run Block, Anchor</div>
            </div>
          </div>
          
          {/* Defense */}
          <div>
            <h4 className="text-orange-400 font-semibold mb-2">Defense</h4>
            <div className="space-y-2 text-gray-400 text-xs">
              <div><strong className="text-white">DL:</strong> Pass Rush, Run Stuff, Contain</div>
              <div><strong className="text-white">LB:</strong> Run D, Pass D, Blitz</div>
              <div><strong className="text-white">DB:</strong> Coverage, Ball Skills, Tackling</div>
            </div>
          </div>
          
          {/* Special Teams */}
          <div>
            <h4 className="text-yellow-400 font-semibold mb-2">Special Teams</h4>
            <div className="text-gray-400 text-xs">
              <strong className="text-white">K:</strong> Accuracy, Range, Clutch
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

// Gameplay Tab Content
function GameplayTab() {
  return (
    <div className="space-y-6">
      {/* Quick Start */}
      <section>
        <h2 className="text-lg font-bold text-white mb-3" style={{ fontFamily: 'var(--f10-display-font)' }}>
          Quick Start
        </h2>
        <div className="space-y-2">
          {[
            { num: 1, title: 'Open Packs', desc: 'Get your free starter cards' },
            { num: 2, title: 'Build Roster', desc: 'Fill 11 starting positions' },
            { num: 3, title: 'Compete', desc: 'Games auto-play at scheduled times' },
          ].map(step => (
            <div key={step.num} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold">
                {step.num}
              </div>
              <div>
                <div className="text-white font-semibold text-sm">{step.title}</div>
                <div className="text-gray-500 text-xs">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How Games Work */}
      <section className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
        <h3 className="text-white font-semibold mb-2" style={{ fontFamily: 'var(--f10-display-font)' }}>
          How Games Work
        </h3>
        <div className="space-y-2 text-sm text-gray-300">
          <p><strong className="text-green-400">Play-by-play</strong> — Each drive is simulated based on matchups</p>
          <p><strong className="text-green-400">Stats matter</strong> — Player attributes drive outcomes</p>
          <p><strong className="text-green-400">Some randomness</strong> — Upsets can happen!</p>
          <p><strong className="text-green-400">Auto-play</strong> — Games run with your current roster</p>
        </div>
      </section>

      {/* Schedule */}
      <section className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(255,230,0,0.08)', border: '1px solid rgba(255,230,0,0.2)' }}>
        <h3 className="text-white font-semibold mb-3" style={{ fontFamily: 'var(--f10-display-font)' }}>
          Season Schedule
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between p-2 rounded-lg bg-black/20">
            <span className="text-cyan-400 font-medium">Regular Season</span>
            <span className="text-gray-300">Monday - Friday</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-black/20">
            <span className="text-purple-400 font-medium">Playoffs</span>
            <span className="text-gray-300">Saturday</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-black/20">
            <span className="text-yellow-400 font-medium">Super Bowl</span>
            <span className="text-gray-300">Sunday</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Games at <strong className="text-white">7 PM</strong> & <strong className="text-white">9 PM EST</strong> daily
        </p>
        <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400">
            Rosters lock <strong className="text-white">10 minutes</strong> before game time
          </p>
        </div>
      </section>

      {/* Super Bowl Prize */}
      <section className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)' }}>
        <h3 className="text-yellow-400 font-semibold mb-2" style={{ fontFamily: 'var(--f10-display-font)' }}>
          Super Bowl Champions
        </h3>
        <p className="text-sm text-gray-300">
          Win the Super Bowl and receive a <strong className="text-yellow-400">Super Bowl Trophy NFT</strong> — a permanent on-chain record of your championship!
        </p>
      </section>

      {/* Pro Tips */}
      <section>
        <h3 className="text-white font-semibold mb-3" style={{ fontFamily: 'var(--f10-display-font)' }}>
          Pro Tips
        </h3>
        <ul className="space-y-2 text-gray-400 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">&#10003;</span>
            <span>Open all packs first to see your full collection</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">&#10003;</span>
            <span>Use the slider to quickly test different builds</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">&#10003;</span>
            <span>Scout opponents before game time to counter their strategy</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">&#10003;</span>
            <span>Update roster before 7 PM EST for changes to apply</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">&#10003;</span>
            <span>Balance offense and defense — weak D loses games!</span>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default function HowToPlay({ user, onLogout, unreadMessages }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('strategy');
  
  const handleLogout = async () => {
    await logout();
    if (onLogout) onLogout();
    router.push('/');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'strategy': return <StrategyTab />;
      case 'cards': return <CardsTab />;
      case 'gameplay': return <GameplayTab />;
      default: return <StrategyTab />;
    }
  };

  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <div className="max-w-2xl mx-auto pb-8">
        <h1 className="text-2xl font-bold text-white mb-4 text-center" style={{ fontFamily: 'var(--f10-display-font)' }}>
          Rules
        </h1>
        
        {/* Tab Navigation - Tile Aesthetic */}
        <div className="flex gap-2 mb-6 p-1 bg-black/30 backdrop-blur border border-white/10 rounded-2xl">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-all duration-200"
                style={{
                  fontFamily: 'var(--f10-display-font)',
                  backgroundColor: isActive ? `${tab.color}15` : 'transparent',
                  border: isActive ? `1px solid ${tab.color}40` : '1px solid transparent',
                  boxShadow: isActive ? `0 0 12px ${tab.color}40` : 'none',
                }}
              >
                <span style={{ color: isActive ? tab.color : '#6b7280' }}>
                  {TabIcons[tab.id](isActive ? tab.color : '#6b7280')}
                </span>
                <span 
                  className="text-xs font-semibold"
                  style={{ color: isActive ? tab.color : '#6b7280' }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
        
        {/* Tab Content */}
        <div className="f10-panel p-5">
          {renderTabContent()}
        </div>
        
        {/* CTA */}
        <div className="mt-6 text-center">
          {!user ? (
            <Link
              href="/"
              className="inline-block px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all"
              style={{ fontFamily: 'var(--f10-display-font)' }}
            >
              Get Started
            </Link>
          ) : (
            <div className="space-y-3">
              <Link
                href="/team"
                className="inline-block px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all"
                style={{ fontFamily: 'var(--f10-display-font)' }}
              >
                Build Your Team
              </Link>
              <div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-6 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
