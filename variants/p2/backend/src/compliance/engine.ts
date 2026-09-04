import { prisma } from "../lib/db.js";
import { hash0x } from "../lib/crypto.js";
import type { Currency, RuleResult, Verdict } from "@gigbridge/shared";
import { evaluateRules, THRESHOLDS, type RuleContext } from "./rules.js";
import fallback from "../fx/fallback.json" with { type: "json" };

function usdMinorOf(amountMinor: number, cur: Currency): number {
  const usdPer = (fallback.usdPer as Record<string, number>)[cur] ?? 1;
  return Math.round(amountMinor * usdPer);
}
function inCurrency(amountMinor: number, from: Currency, to: Currency): number {
  const usdPer = fallback.usdPer as Record<string, number>;
  const usd = amountMinor * (usdPer[from] ?? 1);
  return Math.round(usd / (usdPer[to] ?? 1));
}

export interface CandidatePayment {
  companyId: string;
  freelancerId: string;
  payerName: string;
  payeeName: string;
  payerCountry: string;
  payeeCountry: string;
  srcCurrency: Currency;
  dstCurrency: Currency;
  srcAmountMinor: number;
  purposeCode: string;
  freelancerHasPan: boolean;
}

/** Build the rule context by aggregating the payer/payee payment history. */
export async function buildContext(p: CandidatePayment): Promise<RuleContext> {
  const now = Date.now();
  const since24h = new Date(now - 24 * 3600_000);
  const since72h = new Date(now - 72 * 3600_000);
  const since90d = new Date(now - 90 * 86_400_000);
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const [samePair24h, pair72h, payeeHistory, payerOutwardThisYear] = await Promise.all([
    prisma.payment.count({
      where: {
        companyId: p.companyId,
        freelancerId: p.freelancerId,
        createdAt: { gte: since24h },
        state: { notIn: ["REJECTED", "DRAFT"] },
      },
    }),
    prisma.payment.findMany({
      where: {
        companyId: p.companyId,
        createdAt: { gte: since72h },
        state: { notIn: ["REJECTED", "DRAFT"] },
      },
      select: { srcCurrency: true, srcAmountMinor: true },
    }),
    prisma.payment.findMany({
      where: {
        freelancerId: p.freelancerId,
        createdAt: { gte: since90d },
        state: { in: ["COMPLETED", "SETTLING", "FUNDED"] },
      },
      select: { srcCurrency: true, srcAmountMinor: true },
    }),
    prisma.payment.findMany({
      where: {
        companyId: p.companyId,
        createdAt: { gte: yearStart },
        state: { notIn: ["REJECTED", "DRAFT"] },
      },
      select: { srcCurrency: true, srcAmountMinor: true },
    }),
  ]);

  // Structuring: count payments in the [90% .. 100%) band under the EU threshold.
  const bandLow = THRESHOLDS.EU_EDD_EUR_MINOR * (1 - THRESHOLDS.STRUCTURING_BAND);
  const candidateEur = inCurrency(p.srcAmountMinor, p.srcCurrency, "EUR");
  const inBand = (eurMinor: number) =>
    eurMinor >= bandLow && eurMinor < THRESHOLDS.EU_EDD_EUR_MINOR;
  let structuringCount = pair72h.filter((r) =>
    inBand(inCurrency(r.srcAmountMinor, r.srcCurrency as Currency, "EUR")),
  ).length;
  if (inBand(candidateEur)) structuringCount += 1; // include the candidate

  const payeeAvgUsd =
    payeeHistory.length > 0
      ? Math.round(
          payeeHistory.reduce(
            (s, r) => s + usdMinorOf(r.srcAmountMinor, r.srcCurrency as Currency),
            0,
          ) / payeeHistory.length,
        )
      : 0;

  const payerLrsUsed = payerOutwardThisYear.reduce(
    (s, r) => s + usdMinorOf(r.srcAmountMinor, r.srcCurrency as Currency),
    0,
  );

  return {
    payerName: p.payerName,
    payeeName: p.payeeName,
    payerCountry: p.payerCountry,
    payeeCountry: p.payeeCountry,
    srcCurrency: p.srcCurrency,
    dstCurrency: p.dstCurrency,
    srcAmountMinor: p.srcAmountMinor,
    purposeCode: p.purposeCode,
    freelancerHasPan: p.freelancerHasPan,
    usdAmountMinor: usdMinorOf(p.srcAmountMinor, p.srcCurrency),
    eurAmountMinor: candidateEur,
    inrAmountMinor: inCurrency(p.srcAmountMinor, p.srcCurrency, "INR"),
    samePairCount24h: samePair24h,
    structuringCount72h: structuringCount,
    payeeTrailingAvgUsdMinor: payeeAvgUsd,
    payerLrsUsedUsdMinor: payerLrsUsed,
  };
}

export interface ComplianceOutcome {
  verdict: Verdict;
  results: RuleResult[];
  decisionHash: string;
}

/** Deterministic verdict: any BLOCK -> REJECT; else any FLAG -> FLAG; else APPROVE. */
export function aggregate(results: RuleResult[]): Verdict {
  if (results.some((r) => r.triggered && r.severity === "BLOCK")) return "REJECT";
  if (results.some((r) => r.triggered && r.severity === "FLAG")) return "FLAG";
  return "APPROVE";
}

export async function runCompliance(p: CandidatePayment): Promise<ComplianceOutcome> {
  const ctx = await buildContext(p);
  const results = evaluateRules(ctx);
  const verdict = aggregate(results);
  const decisionHash = hash0x(
    JSON.stringify({ verdict, results: results.map((r) => [r.id, r.triggered]) }),
  );
  return { verdict, results, decisionHash };
}
