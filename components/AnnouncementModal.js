import { useState, useEffect } from 'react';

const ANNOUNCEMENT_KEY = 'f10_announcement_seen';
const CURRENT_ANNOUNCEMENT_ID = 'tier-caps-v1'; // Change this ID to show new announcements

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
          <div className="text-3xl mb-2">⚖️</div>
          <h2 className="text-xl font-bold text-white">New: Tier Caps!</h2>
          <p className="text-cyan-400 text-sm mt-1">Roster Building Update</p>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-gray-300 text-sm leading-relaxed">
            To keep competition fair and strategy meaningful, we've introduced <span className="text-white font-semibold">separate tier caps</span> for offense and defense:
          </p>

          {/* Caps Display */}
          <div className="grid grid-cols-2 gap-3">
            <div 
              className="rounded-xl p-4 text-center"
              style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }}
            >
              <div className="text-2xl font-bold text-cyan-400">42</div>
              <div className="text-xs text-gray-400 mt-1">Offense Cap</div>
              <div className="text-[10px] text-gray-500">6 slots • ~T7 avg</div>
            </div>
            <div 
              className="rounded-xl p-4 text-center"
              style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}
            >
              <div className="text-2xl font-bold text-purple-400">28</div>
              <div className="text-xs text-gray-400 mt-1">Defense Cap</div>
              <div className="text-[10px] text-gray-500">4 slots • ~T7 avg</div>
            </div>
          </div>

          {/* What This Means */}
          <div 
            className="rounded-xl p-4 text-sm"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="font-semibold text-white mb-2">What this means:</div>
            <ul className="text-gray-400 space-y-1.5 text-xs">
              <li>• You can't stack all T10 players anymore</li>
              <li>• Strategy matters more—choose wisely!</li>
              <li>• Kickers are uncapped (just 1 slot)</li>
              <li>• Check the Tier Sum display in your roster</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={handleDismiss}
            className="w-full py-3.5 text-white font-semibold rounded-xl transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.3), rgba(0,229,255,0.15))', border: '1px solid rgba(0,229,255,0.4)' }}
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}
