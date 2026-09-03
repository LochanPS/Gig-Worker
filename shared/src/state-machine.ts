/**
 * Payment lifecycle transition table (TRD 4.2). Single source of truth shared
 * by the backend orchestrator (enforces) and the frontend (renders timeline).
 */

import { TERMINAL_PAYMENT_STATES, type PaymentState } from "./enums.js";

/** Allowed next-states for each state. Empty array => terminal. */
export const PAYMENT_TRANSITIONS: Record<PaymentState, readonly PaymentState[]> = {
  DRAFT: ["COMPLIANCE_CHECK"],
  COMPLIANCE_CHECK: ["APPROVED", "FLAGGED", "REJECTED"],
  FLAGGED: ["APPROVED", "REJECTED"], // admin resolves
  APPROVED: ["RATE_LOCKED"],
  RATE_LOCKED: ["FUNDED", "EXPIRED"],
  FUNDED: ["SETTLING", "REFUNDED"],
  SETTLING: ["COMPLETED", "REFUNDED"],
  COMPLETED: [],
  REJECTED: [],
  REFUNDED: [],
  EXPIRED: ["RATE_LOCKED"], // re-quote allowed
};

export function isTerminal(state: PaymentState): boolean {
  return (TERMINAL_PAYMENT_STATES as readonly PaymentState[]).includes(state);
}

export function canTransition(from: PaymentState, to: PaymentState): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

/** Ordered happy-path steps for the UI timeline (7 lifecycle steps). */
export const TIMELINE_ORDER: readonly PaymentState[] = [
  "DRAFT",
  "COMPLIANCE_CHECK",
  "APPROVED",
  "RATE_LOCKED",
  "FUNDED",
  "SETTLING",
  "COMPLETED",
];
