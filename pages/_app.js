import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import '../styles/globals.css';
import { getMe, setToken, getActiveConferences, getUnreadCount } from '../lib/api';
import PressConference, { PressConferenceBadge } from '../components/PressConference';

export default function App({ Component, pageProps }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeConferences, setActiveConferences] = useState([]);
  const [openConferenceGameId, setOpenConferenceGameId] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const router = useRouter();
  
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
  
  return (
    <>
      <Component 
        {...pageProps} 
        user={user} 
        onLogin={handleLogin}
        onLogout={handleLogout}
        activeConferences={activeConferences}
        onOpenConference={handleOpenConference}
        unreadMessages={unreadMessages}
        onMessageRead={refreshUnreadCount}
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
}
