import Link from 'next/link';
import { useRouter } from 'next/router';
import { cryptoShopEnabled } from '../lib/env';
import AnnouncementModal from './AnnouncementModal';

export default function Layout({ children, user, onLogout, unreadMessages = 0 }) {
  const router = useRouter();
  
  const NAV = {
    team: { color: '#00e5ff' },
    cards: { color: '#ff0080' },
    shop: { color: '#f59e0b' },
    league: { color: '#a855f7' },
    rules: { color: '#00ff7f' },
  };

  const icons = {
    team: (stroke) => (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="12" stroke={stroke} strokeWidth="2.5" fill="none" />
      </svg>
    ),
    cards: (stroke) => (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="8" y="6" width="16" height="20" rx="2" stroke={stroke} strokeWidth="2.5" fill="none" />
      </svg>
    ),
    league: (stroke) => (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M8 8 L24 24 M24 8 L8 24" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
    rules: (stroke) => (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M4 24 Q16 6 28 24" stroke={stroke} strokeWidth="2.5" fill="none" strokeDasharray="4 3" strokeLinecap="round" />
      </svg>
    ),
    shop: (stroke) => (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M6 12 L8 26 L24 26 L26 12 M6 12 L16 6 L26 12" stroke={stroke} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };

  const baseNavItems = [
    { href: '/cards', label: 'My Cards', variant: 'cards' },
    { href: '/leaderboard', label: 'League', variant: 'league', badge: unreadMessages },
    { href: '/team', label: 'My Team', variant: 'team' },
    ...(cryptoShopEnabled ? [{ href: '/shop', label: 'Shop', variant: 'shop' }] : []),
    { href: '/how-to-play', label: 'Rules', variant: 'rules' },
  ];

  const navItems = baseNavItems;
  const mobileNavItems = baseNavItems;
  
  return (
    <div className="f10-app-shell pb-20 md:pb-0">
      {/* Announcement Modal - shows once per announcement */}
      <AnnouncementModal />
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-4 md:py-8">
        {children}
      </main>
      
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-transparent z-50 safe-area-pb">
        <div className="mx-auto max-w-7xl px-3 pb-3">
          <div className="flex justify-between items-center gap-2 px-2 py-2">
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
