// Treasury view (UI_SPEC 5.4 /admin/treasury): what the platform is currently
// holding in escrow, broken down by corridor, and what it has earned in fees.
// Derived from Payment rows — escrow held is money that has been funded on-chain
// but not yet released or refunded.
import type { CorridorHolding, Currency, Treasury } from '@gigbridge/shared';
import { prisma } from '../../lib/db.js';
import { crossRate } from '../fx/rates.js';

// Money is in escrow exactly while it is funded and not yet settled out.
const IN_ESCROW = ['FUNDED', 'SETTLING', 'DISPUTED'] as const;

export async function computeTreasury(): Promise<Treasury> {
  const [held, completed] = await Promise.all([
    prisma.payment.findMany({
      where: { state: { in: [...IN_ESCROW] } },
      select: { srcCurrency: true, dstCurrency: true, srcAmountMinor: true },
    }),
    prisma.payment.findMany({
      where: { state: 'COMPLETED' },
      select: { srcCurrency: true, feeAmountMinor: true },
    }),
  ]);

  const usd = async (minor: number, from: string) =>
    from === 'USD' ? minor : Math.round(minor * (await crossRate(from as Currency, 'USD')).rate);

  const byCorridor = new Map<string, CorridorHolding>();
  for (const p of held) {
    const corridor = `${p.srcCurrency}${p.dstCurrency}`;
    const row = byCorridor.get(corridor) ?? {
      corridor,
      srcCurrency: p.srcCurrency,
      count: 0,
      heldMinor: 0,
      heldMinorUsd: 0,
    };
    row.count += 1;
    row.heldMinor += p.srcAmountMinor;
    row.heldMinorUsd += await usd(p.srcAmountMinor, p.srcCurrency);
    byCorridor.set(corridor, row);
  }

  let feeRevenueMinorUsd = 0;
  for (const p of completed) {
    if (p.feeAmountMinor) feeRevenueMinorUsd += await usd(p.feeAmountMinor, p.srcCurrency);
  }

  const corridors = [...byCorridor.values()].sort((a, b) => b.heldMinorUsd - a.heldMinorUsd);
  return {
    corridors,
    totalHeldMinorUsd: corridors.reduce((s, c) => s + c.heldMinorUsd, 0),
    feeRevenueMinorUsd,
    completedCount: completed.length,
    inEscrowCount: held.length,
  };
}
