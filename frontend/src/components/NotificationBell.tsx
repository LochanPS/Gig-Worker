// Notification centre (FR-7.1, roadmap item 3). The backend has been writing
// notification rows and pushing notification.new over the websocket all along;
// until now nothing read them back, so anything a user did not catch live was
// lost on reload. Bell + unread badge + dropdown list, refreshed on the same
// event the hub already emits.
import { useEffect, useRef, useState } from 'react';
import type { Notification } from '@gigbridge/shared';
import { api } from '../lib/api.js';
import { useWs } from '../lib/ws.js';

function ago(iso: string): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86_400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86_400)}d ago`;
}

export default function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Show read ones too once the menu is open, so the history is browsable.
  const load = (all = false) => api.notifications(all).then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);
  useWs((e) => { if (e.type === 'notification.new') load(open); });

  // Close on an outside click — the menu overlays the page content.
  useEffect(() => {
    if (!open) return;
    const onDown = (ev: MouseEvent) => {
      if (box.current && !box.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    load(next); // opening pulls history; closing goes back to unread-only
  };

  const markRead = async (id: string) => {
    await api.markNotificationRead(id).catch(() => {});
    load(open);
  };

  const markAll = async () => {
    await api.markAllNotificationsRead().catch(() => {});
    load(open);
  };

  return (
    <div className="bell-wrap" ref={box}>
      <button
        className="bell"
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="bell-menu" role="menu">
          <div className="bell-head">
            <b>Notifications</b>
            {unread > 0 && <button className="linkish" onClick={markAll}>Mark all read</button>}
          </div>
          <div className="bell-list">
            {items.map((n) => (
              <button
                key={n.id}
                className={`bell-item${n.read ? ' read' : ''}`}
                onClick={() => !n.read && markRead(n.id)}
                title={n.read ? 'Read' : 'Mark read'}
              >
                <div className="bell-kind">{n.kind.replace(/_/g, ' ').toLowerCase()}</div>
                <div className="bell-msg">{n.message}</div>
                <div className="bell-when">{ago(n.createdAt)}</div>
              </button>
            ))}
            {items.length === 0 && <div className="bell-empty">Nothing yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
