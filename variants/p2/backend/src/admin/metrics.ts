import { prisma } from "../lib/db.js";
import type { AdminMetricsDTO, Corridor, Currency } from "@gigbridge/shared";
import fallback from "../fx/fallback.json" with { type: "json" };

function usdMinor(amountMinor: number, cur: string): number {
  const usdPer = (fallback.usdPer as Record<string, number>)[cur] ?? 1;
  return Math.round(amountMinor * usdPer);
}

export async function computeMetrics(): Promise<AdminMetricsDTO> {
  const [completed, flaggedCount] = await Promise.all([
    prisma.payment.findMany({
      where: { state: "COMPLETED" },
      select: {
        srcCurrency: true,
        srcAmountMinor: true,
        dstCurrency: true,
        feeAmountMinor: true,
        createdAt: true,
        completedAt: true,
      },
    }),
    prisma.payment.count({ where: { state: "FLAGGED" } }),
  ]);

  let volume = 0;
  let fees = 0;
  let settleSecondsTotal = 0;
  const byCorridor = new Map<Corridor, { count: number; volumeUsdMinor: number }>();

  for (const p of completed) {
    const v = usdMinor(p.srcAmountMinor, p.srcCurrency);
    volume += v;
    fees += usdMinor(p.feeAmountMinor ?? 0, p.srcCurrency);
    if (p.completedAt) {
      settleSecondsTotal += (p.completedAt.getTime() - p.createdAt.getTime()) / 1000;
    }
    const pair = `${p.srcCurrency}${p.dstCurrency}` as Corridor;
    const cur = byCorridor.get(pair) ?? { count: 0, volumeUsdMinor: 0 };
    cur.count += 1;
    cur.volumeUsdMinor += v;
    byCorridor.set(pair, cur);
  }

  return {
    totalVolumeUsdMinor: volume,
    feeRevenueUsdMinor: fees,
    paymentsCompleted: completed.length,
    paymentsFlagged: flaggedCount,
    avgSettlementSeconds: completed.length ? Math.round(settleSecondsTotal / completed.length) : 0,
    byCorridor: [...byCorridor.entries()].map(([pair, v]) => ({ pair, ...v })),
  };
}

export type { Currency };
