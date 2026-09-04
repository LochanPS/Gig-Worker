// Validation-level tests for the pay-run + schedule schemas (no DB).
import { describe, it, expect } from 'vitest';
import { createPayRunSchema, createScheduleSchema, CADENCE_DAYS } from '@gigbridge/shared';

const PAYEE = '33333333-3333-3333-3333-333333333333';

describe('createPayRunSchema', () => {
  it('accepts a run with multiple valid items', () => {
    const r = createPayRunSchema.parse({
      note: 'March retainers',
      items: [
        { payeeId: PAYEE, srcCurrency: 'EUR', dstCurrency: 'INR', srcAmountMinor: 50000, purposeCode: 'P0802' },
        { payeeId: PAYEE, srcCurrency: 'USD', dstCurrency: 'INR', srcAmountMinor: 120000, purposeCode: 'P0801' },
      ],
    });
    expect(r.items).toHaveLength(2);
  });

  it('rejects an empty run', () => {
    expect(() => createPayRunSchema.parse({ items: [] })).toThrow();
  });

  it('rejects an item with a non-uuid payee', () => {
    expect(() =>
      createPayRunSchema.parse({ items: [{ payeeId: 'nope', srcCurrency: 'EUR', dstCurrency: 'INR', srcAmountMinor: 1, purposeCode: 'P0802' }] }),
    ).toThrow();
  });

  it('rejects a run over the 50-item cap', () => {
    const item = { payeeId: PAYEE, srcCurrency: 'EUR', dstCurrency: 'INR', srcAmountMinor: 100, purposeCode: 'P0802' } as const;
    expect(() => createPayRunSchema.parse({ items: Array.from({ length: 51 }, () => item) })).toThrow();
  });
});

describe('createScheduleSchema', () => {
  it('accepts a valid recurring schedule', () => {
    const r = createScheduleSchema.parse({
      payeeId: PAYEE,
      srcCurrency: 'EUR',
      dstCurrency: 'INR',
      srcAmountMinor: 200000,
      purposeCode: 'P0802',
      cadence: 'MONTHLY',
    });
    expect(r.cadence).toBe('MONTHLY');
  });

  it('rejects an unknown cadence', () => {
    expect(() =>
      createScheduleSchema.parse({ payeeId: PAYEE, srcCurrency: 'EUR', dstCurrency: 'INR', srcAmountMinor: 1, purposeCode: 'P0802', cadence: 'DAILY' }),
    ).toThrow();
  });

  it('has cadence day-counts for every cadence', () => {
    expect(CADENCE_DAYS.WEEKLY).toBe(7);
    expect(CADENCE_DAYS.BIWEEKLY).toBe(14);
    expect(CADENCE_DAYS.MONTHLY).toBe(30);
  });
});
