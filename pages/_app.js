import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Graduate } from 'next/font/google';
import '../styles/globals.css';
import { getMe, setToken, getActiveConferences, getUnreadCount } from '../lib/api';
import PressConference, { PressConferenceBadge } from '../components/PressConference';
import PlayfieldBackground from '../components/PlayfieldBackground';
import StaticFieldBackground from '../components/StaticFieldBackground';
import { isLive, cryptoShopEnabled } from '../lib/env';
import { WalletProvider } from '../lib/Web3AuthContext';
import { FarcasterWalletProvider } from '../lib/FarcasterWalletContext';
import { isFarcasterMiniApp } from '../lib/farcaster';

const graduate = Graduate({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
});

// iPad Mini width is 768px - disable animations on larger screens
const ANIMATION_MAX_WIDTH = 768;

export default function App({ Component, pageProps }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeConferences, setActiveConferences] = useState([]);
  const [openConferenceGameId, setOpenConferenceGameId] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [useAnimatedBg, setUseAnimatedBg] = useState(false); // Default to static until we check
  const router = useRouter();
  
  // Check screen size for animation toggle
  useEffect(() => {
    const checkScreenSize = () => {
      // Only enable animations on small screens (phone/tablet)
      setUseAnimatedBg(window.innerWidth <= ANIMATION_MAX_WIDTH);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
  useEffect(() => {
    // Check for existing session
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const data = await getMe();
          setUser(data.user);
        } catch (e) {
          // Invalid token
          setToken(null);
        }
      }
      setLoading(false);
    };
    
    checkAuth();
  }, []);
  
  // Check for active press conferences
  useEffect(() => {
    if (!user) {
      setActiveConferences([]);
      return;
    }
    
    const checkConferences = async () => {
      try {
        const data = await getActiveConferences();
        setActiveConferences(data.conferences || []);
      } catch (e) {
        // Ignore errors
      }
    };
    
    checkConferences();
    
    // Poll every 30 seconds
    const interval = setInterval(checkConferences, 30000);
    return () => clearInterval(interval);
  }, [user]);
  
  // Check for unread messages
  useEffect(() => {
    if (!user) {
      setUnreadMessages(0);
      return;
    }
    
    const checkUnread = async () => {
      try {
        const data = await getUnreadCount();
        setUnreadMessages(data.count || 0);
      } catch (e) {
        // Ignore errors
      }
    };
    
    checkUnread();
    
    // Poll every 30 seconds
    const interval = setInterval(checkUnread, 30000);
    return () => clearInterval(interval);
  }, [user]);
  
  const refreshUnreadCount = async () => {
    if (user) {
      try {
        const data = await getUnreadCount();
        setUnreadMessages(data.count || 0);
      } catch (e) {
        // Ignore errors
      }
    }
  };
  
  const handleLogin = (userData) => {
    setUser(userData);
    router.push('/cards');
  };
  
  const handleLogout = () => {
    setUser(null);
    setActiveConferences([]);
    router.push('/');
  };
  
  const handleOpenConference = (gameId) => {
    if (gameId) {
      setOpenConferenceGameId(gameId);
    } else if (activeConferences.length > 0) {
      // Open most recent conference
      setOpenConferenceGameId(activeConferences[0].gameId);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }
  
  // Detect if we're running as a Farcaster Mini App
  const [inFarcaster, setInFarcaster] = useState(false);
  
  useEffect(() => {
    // Always try to call sdk.actions.ready() - it's safe to call even outside Farcaster
    // This must happen ASAP to hide the splash screen
    import('@farcaster/miniapp-sdk').then(({ sdk }) => {
      sdk.actions.ready();
      console.log('[Farcaster] sdk.actions.ready() called');
    }).catch(err => {
      // Expected to fail outside Farcaster context, that's fine
      console.log('[Farcaster] SDK not available (expected outside Warpcast)');
    });
    
    // Check on client side only
    const isFarcaster = isFarcasterMiniApp();
    setInFarcaster(isFarcaster);
  }, []);

  const content = (
    <>
      {/* Preload font used by canvas background */}
      <span
        className={graduate.className}
        aria-hidden="true"
        style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}
      >
        .
      </span>
      {/* Always use static background - animated one causes performance issues */}
      <StaticFieldBackground />
      <Component 
        {...pageProps} 
        user={user} 
        onLogin={handleLogin}
        onLogout={handleLogout}
        activeConferences={activeConferences}
        onOpenConference={handleOpenConference}
        unreadMessages={unreadMessages}
        onMessageRead={refreshUnreadCount}
        inFarcaster={inFarcaster}
      />
      {/* Press Conference Badge */}
      {user && activeConferences.length > 0 && !openConferenceGameId && (
        <PressConferenceBadge 
          count={activeConferences.length}
          onClick={() => handleOpenConference()}
        />
      )}
      
      {/* Press Conference Modal */}
      {openConferenceGameId && (
        <PressConference 
          gameId={openConferenceGameId}
          onClose={() => setOpenConferenceGameId(null)}
        />
      )}
    </>
  );

  // Choose wallet provider based on environment
  if (!cryptoShopEnabled) {
    return content;
  }
  
  // Use Farcaster wallet provider when in Warpcast, otherwise use Web3Auth/MetaMask
  if (inFarcaster) {
    return <FarcasterWalletProvider>{content}</FarcasterWalletProvider>;
  }
  
  return <WalletProvider>{content}</WalletProvider>;
}
