// Validation + state-machine tests for the unhappy paths (no DB).
import { describe, it, expect } from 'vitest';
import { addPayoutAccountSchema, raiseDisputeSchema, resolveDisputeSchema } from '@gigbridge/shared';
import { canTransition } from '../payments/state.js';

const PAY = '55555555-5555-5555-5555-555555555555';

describe('addPayoutAccountSchema', () => {
  it('accepts a valid account', () => {
    const r = addPayoutAccountSchema.parse({ label: 'HDFC', currency: 'INR', accountName: 'Priya', accountNumber: '000123456', bankIdentifier: 'HDFC0001234' });
    expect(r.currency).toBe('INR');
  });
  it('rejects a too-short account number', () => {
    expect(() => addPayoutAccountSchema.parse({ label: 'x', currency: 'INR', accountName: 'y', accountNumber: '12', bankIdentifier: 'z' })).toThrow();
  });
});

describe('dispute schemas', () => {
  it('accepts a raise with a uuid payment + reason', () => {
    expect(raiseDisputeSchema.parse({ paymentId: PAY, reason: 'work not delivered' }).reason).toBe('work not delivered');
  });
  it('rejects an unknown resolve action', () => {
    expect(() => resolveDisputeSchema.parse({ action: 'MAYBE', note: 'x' })).toThrow();
  });
  it('accepts REFUND and DISMISS', () => {
    expect(resolveDisputeSchema.parse({ action: 'REFUND', note: 'valid' }).action).toBe('REFUND');
    expect(resolveDisputeSchema.parse({ action: 'DISMISS', note: 'valid' }).action).toBe('DISMISS');
  });
});

describe('unhappy-path state transitions', () => {
  it('a rate-locked payout can fail for a missing destination', () => {
    expect(canTransition('RATE_LOCKED', 'PAYOUT_FAILED')).toBe(true);
  });
  it('a failed payout can be retried', () => {
    expect(canTransition('PAYOUT_FAILED', 'RATE_LOCKED')).toBe(true);
  });
  it('a completed payment can be disputed', () => {
    expect(canTransition('COMPLETED', 'DISPUTED')).toBe(true);
  });
  it('a dispute resolves to reversed or back to completed', () => {
    expect(canTransition('DISPUTED', 'REVERSED')).toBe(true);
    expect(canTransition('DISPUTED', 'COMPLETED')).toBe(true);
  });
  it('reversed is terminal', () => {
    expect(canTransition('REVERSED', 'COMPLETED')).toBe(false);
  });
  it('does not break the happy path', () => {
    expect(canTransition('SETTLING', 'COMPLETED')).toBe(true);
    expect(canTransition('DRAFT', 'COMPLIANCE_CHECK')).toBe(true);
  });
});
