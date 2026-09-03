import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AdminMetrics, Alert, Notification, PaymentState, TimelineStep, WsEvent } from '@gigbridge/shared';
import { socket, type ConnState } from './ws';

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

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [conn, setConn] = useState<ConnState>('closed');
  const [feed, setFeed] = useState<LivePayment[]>([]);
  const [byPayment, setByPayment] = useState<Record<string, LivePayment>>({});
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const readRef = useRef(0);
  const [unread, setUnread] = useState(0);

  useEffect(() => socket.onState(setConn), []);

  useEffect(
    () =>
      socket.subscribe((event: WsEvent) => {
        if (event.type === 'payment.state') {
          const entry: LivePayment = {
            paymentId: event.paymentId,
            state: event.state,
            timeline: event.timeline ?? [],
            at: Date.now(),
          };
          setByPayment((prev) => ({ ...prev, [entry.paymentId]: entry }));
          setFeed((prev) => [entry, ...prev].slice(0, FEED_CAP));
        } else if (event.type === 'metrics.tick') {
          setMetrics(event.metrics);
        } else if (event.type === 'alert.new') {
          setAlerts((prev) => [event.alert, ...prev].slice(0, 100));
        } else if (event.type === 'notification.new') {
          setNotifications((prev) => [event.notification, ...prev].slice(0, 100));
          setUnread((n) => n + 1);
        }
      }),
    [],
  );

  const value = useMemo<RealtimeValue>(
    () => ({
      conn,
      feed,
      byPayment,
      metrics,
      alerts,
      notifications,
      unread,
      markAllRead: () => {
        readRef.current = notifications.length;
        setUnread(0);
      },
    }),
    [conn, feed, byPayment, metrics, alerts, notifications, unread],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
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
