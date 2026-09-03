/**
 * WebSocket event contract (TRD 4.3 `/ws`). The backend pushes these on every
 * state change so the demo timelines animate live. Frontend switches on `type`.
 */

import type { Alert, ComplianceDecision, Notification, Payment } from "./entities.js";
import type { PaymentState } from "./enums.js";

export const WS_EVENT_TYPES = [
  "payment.state",
  "payment.created",
  "compliance.decided",
  "alert.new",
  "notif.new",
] as const;
export type WsEventType = (typeof WS_EVENT_TYPES)[number];

export interface PaymentStateEvent {
  type: "payment.state";
  paymentId: string;
  from: PaymentState;
  to: PaymentState;
  txHash: string | null;
  at: string;
}

export interface PaymentCreatedEvent {
  type: "payment.created";
  payment: Payment;
}

export interface ComplianceDecidedEvent {
  type: "compliance.decided";
  paymentId: string;
  decision: ComplianceDecision;
}

export interface AlertNewEvent {
  type: "alert.new";
  alert: Alert;
}

export interface NotifNewEvent {
  type: "notif.new";
  notification: Notification;
}

export type WsEvent =
  | PaymentStateEvent
  | PaymentCreatedEvent
  | ComplianceDecidedEvent
  | AlertNewEvent
  | NotifNewEvent;

/** Client -> server hello frame (JWT is sent in the connection query/header). */
export interface WsClientHello {
  type: "hello";
  token: string;
}
