import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { List, X, Bell } from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth';
import { useRealtime } from '@/lib/realtime';
import { cn } from '@/lib/utils';
import { relativeAge } from '@/lib/format';

const NAV: Record<string, { to: string; label: string }[]> = {
  COMPANY: [
    { to: '/company', label: 'Overview' },
    { to: '/company/pay', label: 'New payout' },
    { to: '/company/freelancers', label: 'Freelancers' },
    { to: '/company/invoices', label: 'Invoices' },
  ],
  FREELANCER: [
    { to: '/me', label: 'Balance' },
    { to: '/me/history', label: 'History' },
    { to: '/me/invoices', label: 'Invoices' },
    { to: '/me/identity', label: 'Identity' },
  ],
  ADMIN: [
    { to: '/admin', label: 'Monitor' },
    { to: '/admin/queue', label: 'Review queue' },
    { to: '/admin/alerts', label: 'Alerts' },
    { to: '/admin/rules', label: 'Rules' },
    { to: '/admin/treasury', label: 'Treasury' },
  ],
};

const CONN_LABEL: Record<string, string> = { open: 'live', connecting: 'connecting', closed: 'offline' };

export function ConsoleLayout() {
  const { user, logout } = useAuth();
  const { conn, unread, notifications, markAllRead } = useRealtime();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;
  const items = NAV[user.role] ?? [];

  return (
    <div className="min-h-[100dvh] flex">
      {/* Sidebar */}
      <aside
        className={cn(
          'w-[232px] shrink-0 border-r border-line bg-surface flex flex-col',
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:transition-transform',
          !navOpen && 'max-lg:-translate-x-full',
        )}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-line">
          <span className="text-[16px] font-medium tracking-[0.02em]">GigBridge</span>
          <button className="lg:hidden text-muted" onClick={() => setNavOpen(false)} aria-label="Close navigation">
            <X size={16} />
          </button>
        </div>
        <nav className="py-3 flex flex-col">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/company' || item.to === '/me' || item.to === '/admin'}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                cn(
                  'h-9 flex items-center pl-4 pr-3 text-[13px] border-l-2 transition-colors duration-150',
                  isActive
                    ? 'border-accent text-text'
                    : 'border-transparent text-muted hover:text-text',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-4 py-3 border-t border-line">
          <div className="text-[11px] text-faint uppercase tracking-[0.08em]">{user.role}</div>
          <div className="text-[12px] text-muted truncate mt-0.5">{user.name}</div>
        </div>
      </aside>

      {navOpen ? (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden />
      ) : null}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-line flex items-center gap-3 px-5 shrink-0">
          <button
            className="lg:hidden text-muted hover:text-text"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            <List size={18} />
          </button>

          <div className="ml-auto flex items-center gap-4">
            <span className="num text-[11px] text-faint" title="Realtime connection">
              {CONN_LABEL[conn]}
            </span>

            <div className="relative">
              <button
                onClick={() => {
                  setBellOpen((o) => !o);
                  setMenuOpen(false);
                  markAllRead();
                }}
                className="relative flex items-center text-muted hover:text-text transition-colors"
                aria-label={`Notifications, ${unread} unread`}
              >
                <Bell size={17} />
                {unread > 0 ? (
                  <span className="absolute -top-1 -right-1.5 num text-[9px] text-accent">{unread}</span>
                ) : null}
              </button>
              {bellOpen ? (
                <div className="absolute right-0 top-8 z-50 w-[320px] border border-line bg-raised">
                  <div className="label px-3 h-9 flex items-center border-b border-line">Notifications</div>
                  {notifications.length === 0 ? (
                    <p className="px-3 py-5 text-[12px] text-muted">Nothing yet. Activity appears here as it happens.</p>
                  ) : (
                    <ul className="max-h-[320px] overflow-y-auto">
                      {notifications.slice(0, 20).map((n) => (
                        <li key={n.id} className="px-3 py-2.5 border-b border-line last:border-b-0">
                          <p className="text-[12px] text-text">{n.message}</p>
                          <span className="text-[11px] text-faint">{relativeAge(n.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setMenuOpen((o) => !o);
                  setBellOpen(false);
                }}
                className="h-7 px-2.5 border border-line text-[12px] text-muted hover:text-text hover:border-line-strong transition-colors"
              >
                {user.name}
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-9 z-50 w-[200px] border border-line bg-raised">
                  <div className="px-3 py-2.5 border-b border-line">
                    <div className="text-[12px] text-text truncate">{user.email}</div>
                    <div className="text-[11px] text-faint uppercase tracking-[0.08em] mt-0.5">{user.role}</div>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      navigate('/login', { replace: true });
                    }}
                    className="w-full text-left px-3 h-9 text-[12px] text-muted hover:text-text transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0">
          <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-7">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
