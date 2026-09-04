import type { PaymentState } from "@gigbridge/shared";

// Single source of truth for legal transitions (TRD 4.2). The orchestrator is
// the only writer of Payment.state and must call assertTransition first.
//
//   DRAFT -> COMPLIANCE_CHECK -> (REJECTED | FLAGGED -> RATE_LOCKED | RATE_LOCKED)
//         -> RATE_LOCKED -> FUNDED -> SETTLING -> COMPLETED
//   side paths: REFUNDED (from FUNDED/SETTLING), EXPIRED (from RATE_LOCKED)
export const TRANSITIONS: Record<PaymentState, PaymentState[]> = {
  DRAFT: ["COMPLIANCE_CHECK"],
  COMPLIANCE_CHECK: ["REJECTED", "FLAGGED", "RATE_LOCKED"],
  FLAGGED: ["RATE_LOCKED", "REJECTED"], // admin resolves the flag
  REJECTED: [],
  RATE_LOCKED: ["FUNDED", "EXPIRED"],
  FUNDED: ["SETTLING", "REFUNDED"],
  SETTLING: ["COMPLETED", "REFUNDED"],
  COMPLETED: [],
  REFUNDED: [],
  EXPIRED: [],
};

export function canTransition(from: PaymentState, to: PaymentState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: PaymentState,
    public readonly to: PaymentState,
  ) {
    super(`Illegal payment transition ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: PaymentState, to: PaymentState): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

// The 7 lifecycle steps rendered by the UI timeline (happy path).
export const HAPPY_PATH: PaymentState[] = [
  "DRAFT",
  "COMPLIANCE_CHECK",
  "RATE_LOCKED",
  "FUNDED",
  "SETTLING",
  "COMPLETED",
];
