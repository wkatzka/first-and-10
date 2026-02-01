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
  
  const NAV = {
    team: { color: '#00e5ff' },
    packs: { color: '#ff0080' },
    league: { color: '#a855f7' },
    schedule: { color: '#ffe600' },
    rules: { color: '#00ff7f' },
  };

  const icons = {
    team: (stroke) => (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="12" stroke={stroke} strokeWidth="2.5" fill="none" />
      </svg>
    ),
    packs: (stroke) => (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M8 8 L24 24 M24 8 L8 24" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
    league: (stroke) => (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M6 16 L22 16" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M17 10 L24 16 L17 22" stroke={stroke} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    schedule: (stroke) => (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="5" r="4" stroke={stroke} strokeWidth="2" fill="none" />
        <path d="M16 10 L16 22 L10 28" stroke={stroke} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    rules: (stroke) => (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M4 24 Q16 6 28 24" stroke={stroke} strokeWidth="2.5" fill="none" strokeDasharray="4 3" strokeLinecap="round" />
      </svg>
    ),
  };

  // Desktop navigation items
  const navItems = [
    { href: '/team', label: 'My Team', variant: 'team' },
    { href: '/packs', label: 'Packs', variant: 'packs' },
    { href: '/league', label: 'League', variant: 'league', badge: unreadMessages },
    { href: '/schedule', label: 'Schedule', variant: 'schedule' },
    { href: '/how-to-play', label: 'Rules', variant: 'rules' },
  ];
  
  // Mobile bottom nav
  const mobileNavItems = [
    { href: '/team', label: 'My Team', variant: 'team' },
    { href: '/packs', label: 'Packs', variant: 'packs' },
    { href: '/league', label: 'League', variant: 'league', badge: unreadMessages },
    { href: '/schedule', label: 'Schedule', variant: 'schedule' },
    { href: '/how-to-play', label: 'Rules', variant: 'rules' },
  ];
  
  return (
    <div className="f10-app-shell pb-20 md:pb-0">
      {/* Playbook background */}
      <div className="f10-playbook-bg" aria-hidden="true">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="playbook" x="0" y="0" width="520" height="520" patternUnits="userSpaceOnUse">
              <circle cx="80" cy="60" r="5" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.08" />
              <path d="M80 66 L80 110 L50 150" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.08" />
              <path d="M53 145 L50 150 L55 148" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.08" />

              <circle cx="200" cy="80" r="5" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.06" />
              <path d="M200 86 L200 140 L260 140" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.06" />
              <path d="M255 137 L260 140 L255 143" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.06" />

              <circle cx="350" cy="100" r="5" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.05" />
              <path d="M350 106 L350 180 L400 140" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.05" />
              <path d="M394 144 L400 140 L396 148" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.05" />

              <circle cx="450" cy="200" r="4" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.06" />
              <path d="M450 205 L450 280" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.06" />
              <path d="M450 280 Q450 295 435 295" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.06" />

              <circle cx="120" cy="250" r="4" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.07" />
              <path d="M120 255 L120 380" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.07" />
              <path d="M117 375 L120 380 L123 375" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.07" />

              <circle cx="280" cy="300" r="5" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.05" />
              <path d="M280 306 L280 380 L340 340" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.05" />
              <path d="M334 344 L340 340 L336 348" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.05" />

              <circle cx="60" cy="400" r="4" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.06" />
              <path d="M60 405 L60 430 L180 430" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.06" />
              <path d="M175 427 L180 430 L175 433" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.06" />

              <circle cx="400" cy="380" r="4" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.05" />
              <path d="M400 385 L400 420 Q400 450 430 450 L480 450" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.05" />
              <path d="M475 447 L480 450 L475 453" stroke="#00e5ff" strokeWidth="0.6" fill="none" opacity="0.05" />

              <g opacity="0.04">
                <path d="M147 177 L157 187 M157 177 L147 187" stroke="#ff0080" strokeWidth="0.6" />
              </g>
              <g opacity="0.035">
                <path d="M317 257 L327 267 M327 257 L317 267" stroke="#ff0080" strokeWidth="0.6" />
              </g>
              <g opacity="0.04">
                <path d="M237 407 L247 417 M247 407 L237 417" stroke="#ff0080" strokeWidth="0.6" />
              </g>
              <g opacity="0.03">
                <path d="M427 87 L437 97 M437 87 L427 97" stroke="#ff0080" strokeWidth="0.6" />
              </g>

              <line x1="0" y1="60" x2="520" y2="60" stroke="#00e5ff" strokeWidth="0.3" opacity="0.03" />
              <line x1="0" y1="250" x2="520" y2="250" stroke="#00e5ff" strokeWidth="0.3" opacity="0.025" />
              <line x1="0" y1="400" x2="520" y2="400" stroke="#00e5ff" strokeWidth="0.3" opacity="0.02" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#playbook)" />
        </svg>
      </div>

      {/* Header */}
      <header className="bg-black/30 backdrop-blur border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Logo */}
            <Link href="/team" className="flex items-center gap-2">
              <span className="text-xl md:text-2xl">🏈</span>
              <span className="text-lg md:text-xl f10-title text-white">First & 10</span>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors relative ${
                    router.pathname === item.href
                      ? 'bg-white/10 text-white border border-white/10'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white'
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-transparent z-50 safe-area-pb">
        <div className="mx-auto max-w-7xl px-3 pb-3">
          <div className="flex justify-between items-center gap-2 bg-black/30 backdrop-blur border border-white/10 rounded-2xl px-2 py-2">
          {mobileNavItems.map(item => {
            const isActive = router.pathname === item.href;
            const stroke = NAV[item.variant]?.color || '#ffffff';
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`f10-nav-btn ${item.variant} ${isActive ? 'active' : ''} flex-1 touch-target relative`}
              >
                <span className="f10-nav-icon relative">
                  {icons[item.variant] ? icons[item.variant](stroke) : null}
                  {item.badge > 0 && (
                    <span className="absolute -top-1 -right-3 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </span>
                <span className="f10-nav-text">{item.label}</span>
              </Link>
            );
          })}
          </div>
        </div>
      </nav>
    </div>
  );
}
