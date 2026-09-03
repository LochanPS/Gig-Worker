// Rule-level tests: pure functions over a synthetic EvalContext. No DB/FX.
import { describe, it, expect } from 'vitest';
import { RULES } from './index.js';
import type { EvalContext, Party } from './types.js';
import type { Currency } from '@gigbridge/shared';

const party = (over: Partial<Party>): Party => ({
  id: 'x', name: 'Acme', country: 'DE', role: 'COMPANY', panOrTaxId: null, kycStatus: 'VERIFIED', ...over,
});

function ctx(over: Partial<EvalContext> = {}): EvalContext {
  const rates: Record<Currency, number> = { EUR: 1, USD: 1.08, INR: 90 };
  return {
    payer: party({ country: 'DE', name: 'Novatek GmbH' }),
    payee: party({ country: 'IN', name: 'Priya Sharma', role: 'FREELANCER', panOrTaxId: 'ABCDE1234F' }),
    srcCurrency: 'EUR', dstCurrency: 'INR', srcAmountMinor: 50000, purposeCode: 'P0802',
    toMinor: (c: Currency) => Math.round(50000 * rates[c]),
    sanctionsHitPayer: false, sanctionsHitPayee: false,
    historyToPayee: [], payeeTrailingAvgUsdMinor: 0,
    ...over,
  };
}

const run = (id: string, c: EvalContext) => RULES.find((r) => r.id === id)!.evaluate(c);

describe('compliance rules', () => {
  it('IN-RBI-001 blocks inward remittance with no purpose code', () => {
    expect(run('IN-RBI-001', ctx({ purposeCode: null })).passed).toBe(false);
    expect(run('IN-RBI-001', ctx()).passed).toBe(true);
  });

  it('IN-RBI-002 flags a large inward payment with no PAN', () => {
    const big = ctx({ payee: party({ country: 'IN', name: 'Uma', panOrTaxId: null }), toMinor: () => 60_000_00 });
    expect(run('IN-RBI-002', big).passed).toBe(false);
  });

  it('US-OFAC-001 blocks a sanctions hit', () => {
    expect(run('US-OFAC-001', ctx({ sanctionsHitPayee: true, payee: party({ name: 'SanctionedCo' }) })).passed).toBe(false);
  });

  it('EU-AML-001 flags a payment over EUR 10,000', () => {
    expect(run('EU-AML-001', ctx({ toMinor: () => 12_000_00 })).passed).toBe(false);
    expect(run('EU-AML-001', ctx()).passed).toBe(true);
  });

  it('GB-VEL-001 flags more than 5 payments in 24h', () => {
    const recent = Array.from({ length: 5 }, (_, i) => ({ id: `h${i}`, srcAmountMinor: 100, srcCurrency: 'EUR', createdAt: new Date() }));
    expect(run('GB-VEL-001', ctx({ historyToPayee: recent })).passed).toBe(false);
  });

  it('GB-OUT-001 flags an amount far above the payee average', () => {
    expect(run('GB-OUT-001', ctx({ payeeTrailingAvgUsdMinor: 1000, toMinor: () => 100_000 })).passed).toBe(false);
  });

  it('GDPR rule always passes (no PII on-chain by construction)', () => {
    expect(run('EU-GDPR-001', ctx()).passed).toBe(true);
  });

  it('has exactly 10 rules', () => {
    expect(RULES).toHaveLength(10);
  });
});
