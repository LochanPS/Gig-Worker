// The payout destination is what the company is shown BEFORE it commits to a
// payout, so it has to name the account the off-ramp would really use.
import { describe, it, expect } from 'vitest';
import { maskVpa, describeDestination, activeDestination } from './destination.js';

const upi = { method: 'UPI', currency: 'INR', vpa: 'priya@okhdfcbank', accountNumberMasked: null, active: true };
const bank = { method: 'BANK', currency: 'INR', vpa: null, accountNumberMasked: '••••4821', active: true };

describe('maskVpa', () => {
  it('keeps the first character and the PSP', () => {
    expect(maskVpa('priya@okhdfcbank')).toBe('p****@okhdfcbank');
  });

  it('always stars at least twice, even for a one-character handle', () => {
    expect(maskVpa('a@ybl')).toBe('a**@ybl');
  });

  it('passes through anything that is not a VPA', () => {
    expect(maskVpa('nohandle')).toBe('nohandle');
    expect(maskVpa(null)).toBeNull();
  });
});

describe('describeDestination', () => {
  it('describes a UPI destination by its masked VPA', () => {
    expect(describeDestination(upi)).toEqual({ method: 'UPI', currency: 'INR', masked: 'p****@okhdfcbank' });
  });

  it('describes a bank destination by its masked account number', () => {
    expect(describeDestination(bank)).toEqual({ method: 'BANK', currency: 'INR', masked: '••••4821' });
  });

  it('treats a missing method as BANK (rows predating the UPI leg)', () => {
    expect(describeDestination({ currency: 'INR', accountNumberMasked: '••••1111' })?.method).toBe('BANK');
  });

  it('is null when the payee has no destination — the PAYOUT_FAILED case', () => {
    expect(describeDestination(null)).toBeNull();
  });
});

describe('activeDestination', () => {
  it('picks the first (newest) active account, matching creditPayee', () => {
    expect(activeDestination([upi, bank])?.method).toBe('UPI');
  });

  it('ignores removed accounts', () => {
    expect(activeDestination([{ ...upi, active: false }, bank])?.method).toBe('BANK');
  });

  it('filters by currency when one is given', () => {
    expect(activeDestination([upi], 'EUR')).toBeNull();
    expect(activeDestination([upi], 'INR')?.method).toBe('UPI');
  });

  it('is null for a payee with no accounts at all', () => {
    expect(activeDestination([])).toBeNull();
    expect(activeDestination(undefined)).toBeNull();
  });
});
