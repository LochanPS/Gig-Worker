import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AdminMetrics, Alert, Notification, Payment, PaymentState, TimelineStep, WsEvent } from '@gigbridge/shared';
import { socket, type ConnState } from './ws';
import { api } from './api';
import { useAuth } from './auth';
import { formatMoney } from './money';

export interface LivePayment {
  paymentId: string;
  state: PaymentState;
  timeline: TimelineStep[];
  at: number;
}

interface RealtimeValue {
  conn: ConnState;
  feed: LivePayment[];
  byPayment: Record<string, LivePayment>;
  metrics: AdminMetrics | null;
  alerts: Alert[];
  notifications: Notification[];
  unread: number;
  markAllRead: () => void;
}

const Ctx = createContext<RealtimeValue | null>(null);

const FEED_CAP = 60;
const POLL_MS = 1500;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [conn, setConn] = useState<ConnState>('closed');
  const [feed, setFeed] = useState<LivePayment[]>([]);
  const [byPayment, setByPayment] = useState<Record<string, LivePayment>>({});
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const applyPaymentState = useCallback((paymentId: string, state: PaymentState, timeline: TimelineStep[]) => {
    const entry: LivePayment = { paymentId, state, timeline: timeline ?? [], at: Date.now() };
    setByPayment((prev) => ({ ...prev, [paymentId]: entry }));
    setFeed((prev) => [entry, ...prev].slice(0, FEED_CAP));
  }, []);

  const pushNotification = useCallback((n: Notification) => {
    setNotifications((prev) => [n, ...prev].slice(0, 100));
    setUnread((c) => c + 1);
  }, []);

  useEffect(() => socket.onState(setConn), []);

  useEffect(
    () =>
      socket.subscribe((event: WsEvent) => {
        if (event.type === 'payment.state') {
          applyPaymentState(event.paymentId, event.state, event.timeline);
        } else if (event.type === 'metrics.tick') {
          setMetrics(event.metrics);
        } else if (event.type === 'alert.new') {
          setAlerts((prev) => [event.alert, ...prev].slice(0, 100));
        } else if (event.type === 'notification.new') {
          pushNotification(event.notification);
        }
      }),
    [applyPaymentState, pushNotification],
  );

  // Polling bridge: the mock socket only emits metrics.tick, so we poll the
  // payments list and synthesise payment.state locally. This is what makes a
  // payment created in one window ripple into the others. See INTEGRATION_LOG.
  const seen = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    if (!user) {
      seen.current = null;
      return;
    }
    let cancelled = false;
    const tick = async () => {
      let payments: Payment[];
      try {
        payments = await api.get<Payment[]>('/payments');
      } catch {
        return;
      }
      if (cancelled) return;
      const first = seen.current === null;
      if (seen.current === null) seen.current = new Map();
      const map = seen.current;
      for (const p of payments) {
        const sig = `${p.state}:${p.timeline?.length ?? 0}`;
        const prev = map.get(p.id);
        map.set(p.id, sig);
        if (first || prev === sig) continue;
        applyPaymentState(p.id, p.state, p.timeline ?? []);
        // Per-user notifications for the two states that matter in the demo.
        if (p.state === 'COMPLETED' && user.role === 'FREELANCER' && p.freelancerId === user.id) {
          pushNotification(synthNote(user.id, `You received ${formatMoney(p.dstAmountMinor, p.dstCurrency)}`));
        } else if (p.state === 'FLAGGED' && user.role === 'ADMIN') {
          pushNotification(synthNote(user.id, `A payment was flagged for review`));
        } else if (p.state === 'COMPLIANCE_CHECK' && !prev && user.role === 'ADMIN') {
          pushNotification(synthNote(user.id, `New payment entered compliance`));
        }
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user, applyPaymentState, pushNotification]);

  const value = useMemo<RealtimeValue>(
    () => ({
      conn,
      feed,
      byPayment,
      metrics,
      alerts,
      notifications,
      unread,
      markAllRead: () => setUnread(0),
    }),
    [conn, feed, byPayment, metrics, alerts, notifications, unread],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function synthNote(userId: string, message: string): Notification {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId,
    kind: 'payment',
    message,
    read: false,
    createdAt: new Date().toISOString(),
  };
}

export function useRealtime(): RealtimeValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRealtime must be used inside RealtimeProvider');
  return v;
}

/** Live view of one payment, falling back to the server-rendered copy. */
export function useLivePayment(paymentId: string | undefined) {
  const { byPayment } = useRealtime();
  return paymentId ? byPayment[paymentId] : undefined;
}
