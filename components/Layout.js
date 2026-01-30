import Link from 'next/link';
import { useRouter } from 'next/router';
import { logout } from '../lib/api';

export default function Layout({ children, user, onLogout, unreadMessages = 0 }) {
  const router = useRouter();
  
  const handleLogout = async () => {
    await logout();
    if (onLogout) onLogout();
    router.push('/');
  };
  
  // Desktop navigation items
  const navItems = [
    { href: '/cards', label: 'My Cards', icon: '🃏' },
    { href: '/packs', label: 'Open Packs', icon: '📦' },
    { href: '/roster', label: 'Roster', icon: '📋' },
    { href: '/league', label: 'League', icon: '🏟️', badge: unreadMessages },
    { href: '/schedule', label: 'Schedule', icon: '📅' },
    { href: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
    { href: '/how-to-play', label: 'Help', icon: '📖' },
  ];
  
  // Mobile bottom nav (5 main items)
  const mobileNavItems = [
    { href: '/cards', label: 'Cards', icon: '🃏' },
    { href: '/packs', label: 'Packs', icon: '📦' },
    { href: '/roster', label: 'Roster', icon: '📋' },
    { href: '/league', label: 'League', icon: '🏟️', badge: unreadMessages },
    { href: '/leaderboard', label: 'Ranks', icon: '🏆' },
  ];
  
  return (
    <div className="min-h-screen bg-gray-900 pb-16 md:pb-0">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Logo */}
            <Link href="/cards" className="flex items-center gap-2">
              <span className="text-xl md:text-2xl">🏈</span>
              <span className="text-lg md:text-xl font-bold text-white">First & 10</span>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                    router.pathname === item.href
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {item.label}
                  {item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
            
            {/* User Info */}
            {user && (
              <div className="flex items-center gap-2 md:gap-4">
                <span className="text-gray-300 text-sm hidden sm:inline">
                  {user.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors touch-target"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-4 md:py-8">
        {children}
      </main>
      
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50 safe-area-pb">
        <div className="flex justify-around items-center h-16">
          {mobileNavItems.map(item => {
            const isActive = router.pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full touch-target relative ${
                  isActive ? 'text-blue-400' : 'text-gray-400'
                }`}
              >
                <span className="text-xl mb-0.5 relative">
                  {item.icon}
                  {item.badge > 0 && (
                    <span className="absolute -top-1 -right-3 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
