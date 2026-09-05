// WebSocket event contract (BUILD_CONTRACTS §5). Server -> client JSON.
import type { Payment, Alert, Notification, AdminMetrics } from './types.js';

export type WsEvent =
  | { type: 'payment.state'; paymentId: string; state: Payment['state']; timeline: Payment['timeline'] }
  | { type: 'alert.new'; alert: Alert }
  | { type: 'notification.new'; notification: Notification }
  | { type: 'metrics.tick'; metrics: AdminMetrics }
  // Emitted straight from the EscrowVault event watcher when the CHAIN mines a
  // settlement event — not when our own state machine moves. Only present under
  // SETTLEMENT_MODE=real, and only sent to admins.
  | {
      type: 'chain.event';
      eventName: string;
      escrowId: string;
      txHash: string;
      blockNumber: number | null;
      at: string;
    };
