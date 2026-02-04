import { useState, useEffect } from 'react';

const ANNOUNCEMENT_KEY = 'f10_announcement_seen';
const CURRENT_ANNOUNCEMENT_ID = 'whats-new-v2'; // Change this ID to show new announcements

export default function AnnouncementModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if user has seen this announcement
    const seenId = localStorage.getItem(ANNOUNCEMENT_KEY);
    if (seenId !== CURRENT_ANNOUNCEMENT_ID) {
      // Small delay so it doesn't flash immediately on page load
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(ANNOUNCEMENT_KEY, CURRENT_ANNOUNCEMENT_ID);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div 
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', border: '1px solid rgba(0,229,255,0.3)' }}
      >
        {/* Header */}
        <div 
          className="px-6 py-4 text-center"
          style={{ background: 'rgba(0,229,255,0.1)', borderBottom: '1px solid rgba(0,229,255,0.2)' }}
        >
          <div className="text-3xl mb-2">🏈</div>
          <h2 className="text-xl font-bold text-white">What's New</h2>
          <p className="text-cyan-400 text-sm mt-1">Big gameplay updates!</p>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-3">
          
          {/* Tier Caps */}
          <div 
            className="rounded-xl p-3"
            style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">⚖️</span>
              <span className="font-semibold text-white text-sm">Tier Caps</span>
            </div>
            <p className="text-xs text-gray-400">
              Offense capped at <span className="text-cyan-400 font-bold">42</span>, Defense at <span className="text-purple-400 font-bold">28</span>. No more all-T10 rosters!
            </p>
          </div>

          {/* Strategy */}
          <div 
            className="rounded-xl p-3"
            style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🎯</span>
              <span className="font-semibold text-white text-sm">Strategy Selection</span>
            </div>
            <p className="text-xs text-gray-400">
              Pick <span className="text-purple-400">Pass Heavy</span>, <span className="text-purple-400">Balanced</span>, or <span className="text-purple-400">Run Heavy</span> for offense. Defense too!
            </p>
          </div>

          {/* New Stats */}
          <div 
            className="rounded-xl p-3"
            style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">📊</span>
              <span className="font-semibold text-white text-sm">Player Attributes</span>
            </div>
            <p className="text-xs text-gray-400">
              Each player now has <span className="text-green-400">3 key stats</span>. Compare vs opponents to find matchup advantages!
            </p>
          </div>

          {/* Quick tip */}
          <div className="text-center pt-2">
            <p className="text-[11px] text-gray-500">
              Tap any card → View Card → flip to see attributes
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={handleDismiss}
            className="w-full py-3.5 text-white font-semibold rounded-xl transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.3), rgba(0,229,255,0.15))', border: '1px solid rgba(0,229,255,0.4)' }}
          >
            Let's Go!
          </button>
        </div>
      </div>
    </div>
  );
}
