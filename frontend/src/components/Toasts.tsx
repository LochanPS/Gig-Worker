// Live toasts (UI_SPEC 5.5). Rides the websocket the hub already broadcasts on:
// a state change on your own payment, or a notification addressed to you.
import { useEffect, useState } from 'react';
import type { PaymentState } from '@gigbridge/shared';
import { useWs } from '../lib/ws.js';

interface Toast { id: number; kind: 'state' | 'notif'; title: string; body: string; tone: string }

// Only states worth interrupting someone for — not every intermediate hop.
const NOTABLE: Partial<Record<PaymentState, { title: string; tone: string }>> = {
  COMPLETED: { title: 'Payment completed', tone: 'ok' },
  REJECTED: { title: 'Payment rejected', tone: 'bad' },
  FLAGGED: { title: 'Payment flagged for review', tone: 'warn' },
  PAYOUT_FAILED: { title: 'Payout failed', tone: 'bad' },
  REVERSED: { title: 'Payment reversed', tone: 'bad' },
  DISPUTED: { title: 'Payment disputed', tone: 'warn' },
  EXPIRED: { title: 'Rate lock expired', tone: 'warn' },
};

let seq = 0;

export default function Toasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = (t: Omit<Toast, 'id'>) => setToasts((cur) => [...cur, { ...t, id: ++seq }].slice(-3));

  useWs((e) => {
    if (e.type === 'payment.state') {
      const meta = NOTABLE[e.state];
      if (meta) push({ kind: 'state', title: meta.title, body: `Payment ${e.paymentId.slice(0, 8)}…`, tone: meta.tone });
    } else if (e.type === 'notification.new') {
      push({ kind: 'notif', title: e.notification.kind.replace(/_/g, ' ').toLowerCase(), body: e.notification.message, tone: 'info' });
    }
  });

  // Each toast retires itself after 6s.
  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((cur) => cur.slice(1)), 6000);
    return () => clearTimeout(t);
  }, [toasts]);

  if (toasts.length === 0) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`} onClick={() => setToasts((c) => c.filter((x) => x.id !== t.id))}>
          <div className="toast-title">{t.title}</div>
          <div className="toast-body">{t.body}</div>
        </div>
      ))}
    </div>
  );
}
