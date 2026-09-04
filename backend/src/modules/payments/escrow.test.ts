// Escrow mode + rate-lock expiry contract (no DB).
import { describe, it, expect } from 'vitest';
import { createPaymentSchema } from '@gigbridge/shared';
import { canTransition } from './state.js';

const base = {
  payeeId: '33333333-3333-3333-3333-333333333333',
  srcCurrency: 'EUR',
  dstCurrency: 'INR',
  srcAmountMinor: 50_000,
  purposeCode: 'P0802',
};

describe('escrowMode on createPaymentSchema', () => {
  it('defaults to INSTANT so existing callers are unchanged', () => {
    expect(createPaymentSchema.parse(base).escrowMode).toBe('INSTANT');
  });

  it('accepts HOLD for fund-at-gig-start (FR-2.2)', () => {
    expect(createPaymentSchema.parse({ ...base, escrowMode: 'HOLD' }).escrowMode).toBe('HOLD');
  });

  it('rejects an unknown mode', () => {
    expect(() => createPaymentSchema.parse({ ...base, escrowMode: 'MAYBE' })).toThrow();
  });
});

describe('release-on-approval path', () => {
  it('a held escrow sits at FUNDED and can still be settled', () => {
    expect(canTransition('FUNDED', 'SETTLING')).toBe(true);
    expect(canTransition('SETTLING', 'COMPLETED')).toBe(true);
  });

  it('a held escrow can be refunded instead of released', () => {
    expect(canTransition('FUNDED', 'REFUNDED')).toBe(true);
  });

  it('a held escrow cannot jump straight to COMPLETED', () => {
    expect(canTransition('FUNDED', 'COMPLETED')).toBe(false);
  });
});

describe('rate-lock expiry', () => {
  it('a stale rate lock can expire', () => {
    expect(canTransition('RATE_LOCKED', 'EXPIRED')).toBe(true);
  });

  it('EXPIRED is terminal — an expired lock cannot quietly become funded', () => {
    expect(canTransition('EXPIRED', 'FUNDED')).toBe(false);
    expect(canTransition('EXPIRED', 'RATE_LOCKED')).toBe(false);
  });
});
