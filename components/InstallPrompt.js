import { useState, useEffect } from 'react';

/**
 * Prompts iOS/Android users to install the PWA
 * Shows a banner with instructions for adding to home screen
 */
export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  
  useEffect(() => {
    // Check if already installed (running as standalone PWA)
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone 
      || document.referrer.includes('android-app://');
    setIsStandalone(standalone);
    
    // Check platform
    const ua = window.navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const android = /Android/.test(ua);
    setIsIOS(iOS);
    setIsAndroid(android);
    
    // Check if dismissed before
    const dismissed = localStorage.getItem('installPromptDismissed');
    const dismissedDate = dismissed ? new Date(dismissed) : null;
    const daysSinceDismissed = dismissedDate 
      ? (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;
    
    // Show prompt if:
    // - Not already installed
    // - On mobile
    // - Not dismissed in last 7 days
    if (!standalone && (iOS || android) && daysSinceDismissed > 7) {
      // Delay showing prompt
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);
  
  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('installPromptDismissed', new Date().toISOString());
  };
  
  if (!showPrompt || isStandalone) return null;
  
  return (
    <div className="fixed bottom-20 left-4 right-4 md:hidden z-40 animate-slide-up">
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="text-3xl">🏈</span>
          <div className="flex-1">
            <h3 className="font-bold text-white text-sm">Install First & 10</h3>
            <p className="text-gray-400 text-xs mt-1">
              {isIOS ? (
                <>Tap <span className="inline-flex items-center"><svg className="w-4 h-4 inline text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path d="M13 7h-2V5a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0V9h2a1 1 0 100-2z"/><path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h10v10H5V5z" clipRule="evenodd"/></svg></span> then "Add to Home Screen"</>
              ) : (
                <>Tap menu (⋮) then "Add to Home Screen"</>
              )}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-500 hover:text-white p-1"
          >
            ✕
          </button>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
