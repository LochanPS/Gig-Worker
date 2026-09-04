// WebSocket event contract (BUILD_CONTRACTS §5). Server -> client JSON.
import type { Payment, Alert, Notification, AdminMetrics } from './types.js';

export type WsEvent =
  | { type: 'payment.state'; paymentId: string; state: Payment['state']; timeline: Payment['timeline'] }
  | { type: 'alert.new'; alert: Alert }
  | { type: 'notification.new'; notification: Notification }
  | { type: 'metrics.tick'; metrics: AdminMetrics };
