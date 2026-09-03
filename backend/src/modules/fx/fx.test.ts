// FX tests run in offline mode so they're deterministic and network-free.
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.FX_OFFLINE = 'true';
});

describe('fx engine (offline fallback)', () => {
  it('computes a EUR->INR quote using the snapshot rate', async () => {
    const { createQuote } = await import('./fx.service.js');
    const q = await createQuote('EURINR', 50000); // EUR 500.00 in cents
    expect(q.midRate).toBeCloseTo(90.24, 1);
    // fee = 0.75% of 50000 = 375, floored at min 100 => 375
    expect(q.feeMinor).toBe(375);
    expect(q.payeeReceivesMinor).toBeGreaterThan(4_400_000);
    expect(q.incumbentFeeMinor).toBe(4500); // 9% of 50000
  });

  it('enforces the minimum fee on tiny amounts', async () => {
    const { createQuote } = await import('./fx.service.js');
    const q = await createQuote('EURINR', 1000); // EUR 10.00; 0.75% = 7.5 -> floored to 100
    expect(q.feeMinor).toBe(100);
  });

  it('derives INR->USD as the inverse cross rate', async () => {
    const { crossRate } = await import('./rates.js');
    const eurinr = await crossRate('EUR', 'INR');
    const inrusd = await crossRate('INR', 'USD');
    expect(inrusd.rate).toBeGreaterThan(0);
    expect(inrusd.rate).toBeLessThan(1);
    expect(eurinr.source).toBe('fallback');
  });

  it('returns a history series ending today', async () => {
    const { rateHistory } = await import('./fx.service.js');
    const h = await rateHistory('USDINR', 30);
    expect(h).toHaveLength(30);
    expect(h.at(-1)?.date).toBe(new Date().toISOString().slice(0, 10));
  });
});
