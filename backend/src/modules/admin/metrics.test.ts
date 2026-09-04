// Metrics derivation (no DB) — the pure halves of computeMetrics().
import { describe, it, expect } from 'vitest';
import { settlementSeconds, flaggedPercent } from './metrics.service.js';

const at = (secondsFromZero: number) => new Date(1_700_000_000_000 + secondsFromZero * 1000);

describe('settlementSeconds', () => {
  it('measures CREATED -> CREDITED', () => {
    expect(settlementSeconds([
      { key: 'CREATED', at: at(0) },
      { key: 'FUNDED', at: at(12) },
      { key: 'CREDITED', at: at(47) },
    ])).toBe(47);
  });

  it('falls back to RELEASED when the off-ramp step is missing', () => {
    expect(settlementSeconds([
      { key: 'CREATED', at: at(0) },
      { key: 'RELEASED', at: at(30) },
    ])).toBe(30);
  });

  it('is null for a payment that never settled', () => {
    expect(settlementSeconds([
      { key: 'CREATED', at: at(0) },
      { key: 'COMPLIANCE_APPROVED', at: at(2) },
    ])).toBeNull();
  });

  it('is null when there is no creation step to measure from', () => {
    expect(settlementSeconds([{ key: 'CREDITED', at: at(9) }])).toBeNull();
  });
});

describe('flaggedPercent', () => {
  it('is zero with no decisions rather than NaN', () => {
    expect(flaggedPercent([])).toBe(0);
  });

  it('counts FLAG and REJECT as not-clean', () => {
    expect(flaggedPercent(['APPROVE', 'APPROVE', 'FLAG', 'REJECT'])).toBe(50);
  });

  it('is zero when everything approved', () => {
    expect(flaggedPercent(['APPROVE', 'APPROVE'])).toBe(0);
  });

  it('rounds to one decimal', () => {
    expect(flaggedPercent(['APPROVE', 'APPROVE', 'FLAG'])).toBe(33.3);
  });
});
