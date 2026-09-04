// Roster payability (no DB).
import { describe, it, expect } from 'vitest';
import { isPayable } from './directory.service.js';

describe('isPayable', () => {
  it('is true for a verified freelancer with a payout account', () => {
    expect(isPayable('VERIFIED', ['INR'])).toBe(true);
  });

  it('is false when verified but with nowhere for the money to land', () => {
    expect(isPayable('VERIFIED', [])).toBe(false);
  });

  it('is false when unverified, even with a payout account', () => {
    expect(isPayable('PENDING', ['INR'])).toBe(false);
  });

  it('is false for a rejected KYC', () => {
    expect(isPayable('REJECTED', ['INR', 'USD'])).toBe(false);
  });
});
