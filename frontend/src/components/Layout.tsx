import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth.js';

// Minimal inline icon set (no icon dependency) — 24px stroke glyphs.
const I = {
  home: 'M3 11.5 12 4l9 7.5M5 10v9h5v-6h4v6h5v-9',
  pay: 'M3 7h18v10H3zM3 11h18M7 15h4',
  batch: 'M4 7l8-4 8 4-8 4-8-4zm0 5l8 4 8-4M4 17l8 4 8-4',
  repeat: 'M4 9a8 8 0 0 1 13-3l3 3M20 15a8 8 0 0 1-13 3l-3-3M17 3v6h-6M7 21v-6h6',
  invoice: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
  verify: 'M12 3l7 3v6c0 4-3 6.5-7 9-4-2.5-7-5-7-9V6z M9 12l2 2 4-4',
  wallet: 'M3 7h15a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3zM3 7V6a2 2 0 0 1 2-2h11M17 12h.01',
  bank: 'M3 9l9-5 9 5M4 9v9M20 9v9M8 9v9M16 9v9M3 20h18',
  monitor: 'M3 12h4l2 5 4-12 2 7h6',
} as const;

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function initials(name?: string) {
  if (!name) return '·';
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <nav className="nav">
        <div className="brand">
          <span className="dot">C</span>
          <span>Corridor<div className="sub-brand">Cross-border payouts</div></span>
        </div>

        {user?.role === 'COMPANY' && <>
          <NavLink to="/company" end><Icon d={I.home} />Overview</NavLink>
          <NavLink to="/company/pay"><Icon d={I.pay} />New payout</NavLink>
          <NavLink to="/company/batch"><Icon d={I.batch} />Batch pay</NavLink>
          <NavLink to="/company/schedules"><Icon d={I.repeat} />Recurring</NavLink>
          <NavLink to="/company/invoices"><Icon d={I.invoice} />Invoices</NavLink>
          <NavLink to="/verify"><Icon d={I.verify} />Verify</NavLink>
        </>}
        {user?.role === 'FREELANCER' && <>
          <NavLink to="/me" end><Icon d={I.wallet} />My earnings</NavLink>
          <NavLink to="/me/invoices"><Icon d={I.invoice} />Invoices</NavLink>
          <NavLink to="/me/payout-accounts"><Icon d={I.bank} />Payout methods</NavLink>
          <NavLink to="/verify"><Icon d={I.verify} />Verify</NavLink>
        </>}
        {user?.role === 'ADMIN' && <NavLink to="/admin" end><Icon d={I.monitor} />Monitor</NavLink>}

        <div className="spacer" />
        <div className="who">
          <span className="avatar">{initials(user?.name)}</span>
          <span>{user?.name}<div className="role">{user?.role}</div></span>
        </div>
        <button className="btn ghost" onClick={logout} style={{ width: '100%', marginTop: 4 }}>Sign out</button>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
