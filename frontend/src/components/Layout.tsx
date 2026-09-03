import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth.js';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <nav className="nav">
        <div className="brand"><span className="dot" />GigBridge</div>
        {user?.role === 'COMPANY' && <>
          <NavLink to="/company" end>Overview</NavLink>
          <NavLink to="/company/pay">New payout</NavLink>
        </>}
        {user?.role === 'FREELANCER' && <NavLink to="/me" end>My earnings</NavLink>}
        {user?.role === 'ADMIN' && <NavLink to="/admin" end>Monitor</NavLink>}
        <div className="spacer" />
        <div className="who">{user?.name}<br /><span className="mono">{user?.role}</span></div>
        <button className="btn ghost" onClick={logout}>Sign out</button>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
