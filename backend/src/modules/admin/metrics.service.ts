// Platform metrics for the operator dashboard (UI_SPEC §5, FR-6.3). The frontend
// has always called GET /admin/metrics; until now only the mock server answered
// it, so the admin dashboard 404'd against the real backend.
//
// Everything here is derived from real rows — no fixtures. Amounts live in each
// payment's own minor units (EUR cents, USD cents, INR paise), so they are
// converted to USD minor through the same FX source the quotes use before being
// summed; that is what makes the volume and revenue figures comparable.
import type { AdminMetrics, Currency } from '@gigbridge/shared';
import { prisma } from '../../lib/db.js';
import { crossRate } from '../fx/rates.js';

const DAY_MS = 86_400_000;

// Pure — settlement duration for one payment, in seconds, from its timeline.
// Null when the payment never reached a credited/released step.
export function settlementSeconds(steps: { key: string; at: Date }[]): number | null {
  const created = steps.find((s) => s.key === 'CREATED')?.at;
  const done = steps.find((s) => s.key === 'CREDITED')?.at ?? steps.find((s) => s.key === 'RELEASED')?.at;
  if (!created || !done) return null;
  const secs = (done.getTime() - created.getTime()) / 1000;
  return secs >= 0 ? secs : null;
}

// Pure — share of decisions that were not a clean APPROVE, as a percentage.
export function flaggedPercent(verdicts: string[]): number {
  if (verdicts.length === 0) return 0;
  const notApproved = verdicts.filter((v) => v !== 'APPROVE').length;
  return +((notApproved / verdicts.length) * 100).toFixed(1);
}

// Convert a minor-unit amount in `from` into USD minor units.
async function toUsdMinor(amountMinor: number, from: string): Promise<number> {
  if (from === 'USD') return amountMinor;
  const { rate } = await crossRate(from as Currency, 'USD');
  return Math.round(amountMinor * rate);
}

export async function computeMetrics(now: Date = new Date()): Promise<AdminMetrics> {
  const since = new Date(now.getTime() - DAY_MS);

  const [recent, settled, decisions] = await Promise.all([
    // Money that actually moved in the last 24h — funded or beyond, not drafts.
    prisma.payment.findMany({
      where: {
        createdAt: { gte: since },
        state: { in: ['FUNDED', 'SETTLING', 'COMPLETED', 'DISPUTED'] },
      },
      select: { srcCurrency: true, dstCurrency: true, srcAmountMinor: true, feeAmountMinor: true },
    }),
    // Settlement time is measured over completed payments, whenever they ran.
    prisma.payment.findMany({
      where: { state: 'COMPLETED' },
      select: { timeline: { select: { key: true, at: true }, orderBy: { at: 'asc' } } },
      take: 200,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.complianceDecision.findMany({ select: { verdict: true }, take: 500, orderBy: { createdAt: 'desc' } }),
  ]);

  let volumeMinorUsd = 0;
  let revenueMinorUsd = 0;
  const corridors = new Set<string>();
  for (const p of recent) {
    volumeMinorUsd += await toUsdMinor(p.srcAmountMinor, p.srcCurrency);
    if (p.feeAmountMinor) revenueMinorUsd += await toUsdMinor(p.feeAmountMinor, p.srcCurrency);
    corridors.add(`${p.srcCurrency}${p.dstCurrency}`);
  }

  const durations = settled.map((p) => settlementSeconds(p.timeline)).filter((d): d is number => d !== null);
  const avgSettlementSeconds = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  return {
    volume24hMinorUsd: volumeMinorUsd,
    revenueMinorUsd,
    activeCorridors: corridors.size,
    avgSettlementSeconds,
    flaggedPct: flaggedPercent(decisions.map((d) => d.verdict)),
  };
}
