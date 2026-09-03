// Validation-level tests for the invoice schema (no DB).
import { describe, it, expect } from 'vitest';
import { createInvoiceSchema } from '@gigbridge/shared';

describe('invoice schema', () => {
  it('accepts a valid invoice', () => {
    const r = createInvoiceSchema.parse({
      companyId: '11111111-1111-1111-1111-111111111111',
      amountMinor: 50000,
      currency: 'EUR',
      memo: 'Landing page build',
    });
    expect(r.amountMinor).toBe(50000);
  });

  it('rejects a non-uuid company', () => {
    expect(() => createInvoiceSchema.parse({ companyId: 'nope', amountMinor: 1, currency: 'EUR', memo: 'x' })).toThrow();
  });

  it('rejects a zero/negative amount', () => {
    expect(() => createInvoiceSchema.parse({ companyId: '11111111-1111-1111-1111-111111111111', amountMinor: 0, currency: 'EUR', memo: 'x' })).toThrow();
  });

  it('rejects an unknown currency', () => {
    expect(() => createInvoiceSchema.parse({ companyId: '11111111-1111-1111-1111-111111111111', amountMinor: 100, currency: 'GBP', memo: 'x' })).toThrow();
  });
});
