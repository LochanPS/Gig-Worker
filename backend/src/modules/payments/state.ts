// Payment state machine (TRD 4.2). Single source of truth for legal transitions
// and the canonical 7-step demo timeline.
import type { PaymentState } from '@gigbridge/shared';

// Allowed transitions. Any move not listed here is rejected by assertTransition.
const TRANSITIONS: Record<PaymentState, PaymentState[]> = {
  DRAFT: ['COMPLIANCE_CHECK'],
  COMPLIANCE_CHECK: ['RATE_LOCKED', 'FLAGGED', 'REJECTED'],
  FLAGGED: ['RATE_LOCKED', 'COMPLIANCE_CHECK', 'REJECTED'], // admin resolves the flag
  REJECTED: [],
  RATE_LOCKED: ['FUNDED', 'EXPIRED'],
  FUNDED: ['SETTLING', 'REFUNDED'],
  SETTLING: ['COMPLETED', 'REFUNDED'],
  COMPLETED: [],
  REFUNDED: [],
  EXPIRED: [],
};

export function canTransition(from: PaymentState, to: PaymentState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: PaymentState, to: PaymentState): void {
  if (!canTransition(from, to)) {
    throw Object.assign(new Error(`Illegal payment transition ${from} -> ${to}`), { statusCode: 409 });
  }
}

export const isTerminal = (s: PaymentState): boolean => TRANSITIONS[s].length === 0;

// The canonical timeline steps a completed payment walks through, in order.
export const TIMELINE_STEPS: { key: string; label: string; state: PaymentState }[] = [
  { key: 'CREATED', label: 'Payment created', state: 'DRAFT' },
  { key: 'COMPLIANCE_APPROVED', label: 'Compliance approved', state: 'COMPLIANCE_CHECK' },
  { key: 'RATE_LOCKED', label: 'FX rate locked', state: 'RATE_LOCKED' },
  { key: 'FUNDED', label: 'Escrow funded on-chain', state: 'FUNDED' },
  { key: 'SETTLING', label: 'Settling', state: 'SETTLING' },
  { key: 'RELEASED', label: 'Released to payee', state: 'COMPLETED' },
  { key: 'CREDITED', label: 'Payee credited', state: 'COMPLETED' },
];
