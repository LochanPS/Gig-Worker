// Real compliance engine (step 5). Builds an EvalContext from the DB + FX,
// runs all 10 rules, aggregates a verdict, and produces a deterministic
// template explanation (step 6's LLM replaces the explanation text only).
import type { Currency, Verdict, RuleResult } from '@gigbridge/shared';
import { prisma } from '../../lib/db.js';
import { crossRate } from '../fx/rates.js';
import { RULES } from './rules/index.js';
import { toResult, type EvalContext, type Party } from './rules/types.js';
import { isSanctioned } from './rules/sanctions.js';
import { setComplianceEngine, hashDecision, type ComplianceContext, type ComplianceOutcome } from './compliance.interface.js';

function aggregate(results: RuleResult[]): Verdict {
  const failed = results.filter((r) => !r.passed);
  if (failed.some((r) => r.severity === 'BLOCK')) return 'REJECT';
  if (failed.some((r) => r.severity === 'FLAG')) return 'FLAG';
  return 'APPROVE';
}

async function loadParty(userId: string): Promise<Party> {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { freelancer: true },
  });
  return {
    id: u.id,
    name: u.name,
    country: u.country,
    role: u.role,
    panOrTaxId: u.freelancer?.panOrTaxId ?? null,
    kycStatus: u.freelancer?.kycStatus ?? 'VERIFIED',
  };
}

async function buildContext(ctx: ComplianceContext): Promise<EvalContext> {
  const [payer, payee] = await Promise.all([loadParty(ctx.payerId), loadParty(ctx.payeeId)]);

  // Pre-fetch cross rates once for threshold conversions.
  const [toEur, toUsd, toInr] = await Promise.all([
    crossRate(ctx.srcCurrency as Currency, 'EUR'),
    crossRate(ctx.srcCurrency as Currency, 'USD'),
    crossRate(ctx.srcCurrency as Currency, 'INR'),
  ]);
  const rateTo: Record<Currency, number> = { EUR: toEur.rate, USD: toUsd.rate, INR: toInr.rate };
  const toMinor = (c: Currency) => Math.round(ctx.srcAmountMinor * rateTo[c]);

  // Payer -> this payee history (velocity/structuring), newest first.
  const historyRows = await prisma.payment.findMany({
    where: { companyId: ctx.payerId, freelancerId: ctx.payeeId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const historyToPayee = historyRows.map((h) => ({
    id: h.id,
    srcAmountMinor: h.srcAmountMinor,
    srcCurrency: h.srcCurrency,
    createdAt: h.createdAt,
  }));

  // Payee trailing average in USD minor (outlier baseline).
  const received = await prisma.payment.findMany({
    where: { freelancerId: ctx.payeeId, state: 'COMPLETED' },
    take: 90,
    orderBy: { createdAt: 'desc' },
  });
  let avgUsd = 0;
  if (received.length) {
    const usdVals = await Promise.all(
      received.map(async (r) => {
        const cr = await crossRate(r.srcCurrency as Currency, 'USD');
        return r.srcAmountMinor * cr.rate;
      }),
    );
    avgUsd = usdVals.reduce((a, b) => a + b, 0) / usdVals.length;
  }

  return {
    payer,
    payee,
    srcCurrency: ctx.srcCurrency as Currency,
    dstCurrency: ctx.dstCurrency as Currency,
    srcAmountMinor: ctx.srcAmountMinor,
    purposeCode: ctx.purposeCode,
    toMinor,
    sanctionsHitPayer: isSanctioned(payer.name),
    sanctionsHitPayee: isSanctioned(payee.name),
    historyToPayee,
    payeeTrailingAvgUsdMinor: avgUsd,
  };
}

// Deterministic fallback explanation (step 6 overrides with the LLM when a key is set).
export function templateExplanation(ec: EvalContext, verdict: Verdict, results: RuleResult[]): string {
  const amount = (ec.srcAmountMinor / 100).toFixed(2);
  const failed = results.filter((r) => !r.passed);
  const head = `${ec.srcCurrency} ${amount} from ${ec.payer.name} (${ec.payer.country}) to ${ec.payee.name} (${ec.payee.country})`;
  if (verdict === 'APPROVE') {
    return `${head}: all ${results.length} checks passed across ${new Set(results.map((r) => r.jurisdiction)).size} jurisdictions. Purpose code ${ec.purposeCode ?? 'n/a'}. Approved for settlement.`;
  }
  if (verdict === 'REJECT') {
    return `${head}: REJECTED. Blocking issue(s): ${failed.filter((r) => r.severity === 'BLOCK').map((r) => `${r.ruleId} — ${r.message}`).join('; ')}.`;
  }
  return `${head}: FLAGGED for manual review. ${failed.map((r) => `${r.ruleId} — ${r.message}`).join('; ')}.`;
}

export async function evaluateCompliance(ctx: ComplianceContext): Promise<ComplianceOutcome> {
  const ec = await buildContext(ctx);
  const ruleResults = RULES.map((r) => toResult(r, ec));
  const verdict = aggregate(ruleResults);
  const agentExplanation = templateExplanation(ec, verdict, ruleResults);
  return { verdict, ruleResults, agentExplanation, decisionHash: hashDecision(verdict, ruleResults) };
}

// Called at startup to swap the stub for the real engine.
export function registerComplianceEngine(): void {
  setComplianceEngine(evaluateCompliance);
}
