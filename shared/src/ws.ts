// WebSocket event contract (server -> client), BUILD_CONTRACTS.txt section 5.
import type {
  PaymentState,
  TimelineEntry,
  AlertDTO,
  NotificationDTO,
  AdminMetricsDTO,
} from "./types.js";

export interface PaymentStateEvent {
  type: "payment.state";
  paymentId: string;
  state: PaymentState;
  timeline: TimelineEntry[];
}

export interface AlertNewEvent {
  type: "alert.new";
  alert: AlertDTO;
}

export interface NotificationNewEvent {
  type: "notification.new";
  notification: NotificationDTO;
}

export interface MetricsTickEvent {
  type: "metrics.tick";
  metrics: AdminMetricsDTO;
}

export type ServerEvent =
  | PaymentStateEvent
  | AlertNewEvent
  | NotificationNewEvent
  | MetricsTickEvent;

export type ServerEventType = ServerEvent["type"];
