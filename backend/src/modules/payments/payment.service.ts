// Payment orchestrator (TRD 4.2). Owns the state machine, persistence, audit
// logging, and websocket broadcast. Depends on FX (quoting), compliance (verdict),
// and settlement (on-chain) through their ports so later steps swap real impls in.
import { keccak256, toUtf8 } from '../../lib/hash.js';
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';
import { emitToUsers } from '../../lib/ws.js';
import { assertTransition, TIMELINE_STEPS } from './state.js';
import { createQuote, getQuote, isQuoteValid } from '../fx/fx.service.js';
import { getComplianceEngine } from '../compliance/compliance.interface.js';
import { raiseAlertsFromRules } from '../alerts/alert.service.js';
import { markInvoicePaidByPayment } from '../invoices/invoice.service.js';
import { getSettlement } from '../settlement/settlement.interface.js';
import { hasActivePayoutAccount } from '../payouts/payout-account.service.js';
import { getPayoutRail, destinationFromAccount } from '../payouts/payout-rail.interface.js';
import { adjudicate, resolveAction } from '../agent/adjudicator.js';
import { env } from '../../lib/env.js';
import type { PaymentState, Role } from '@gigbridge/shared';
import type { CreatePaymentInput } from '@gigbridge/shared';

function pairOf(src: string, dst: string): string {
  return `${src}${dst}`;
}

// Rough src-minor → USD-minor, only for the adjudicator's value ceiling. Not a
// settlement rate; approximate fixed factors are fine here.
function toUsdMinorApprox(amountMinor: number, ccy: string): number {
  const perUsd: Record<string, number> = { USD: 1, EUR: 1.08, INR: 1 / 83 };
  return Math.round(amountMinor * (perUsd[ccy] ?? 1));
}

// Mask a UPI VPA for the "credited to <vpa>" timeline detail (p****@okhdfcbank).
function maskVpa(vpa: string): string {
  const at = vpa.indexOf('@');
  if (at <= 0) return vpa;
  return `${vpa.slice(0, 1)}${'*'.repeat(Math.max(2, at - 1))}@${vpa.slice(at + 1)}`;
}

// The on-chain address the escrow will release to. This used to fall back to the
// literal '0xpayee' because settlement ignored the argument entirely; now that the
// stored wallet is the account money actually moves to, a missing one is a real
// precondition failure and says so instead of funding into a placeholder.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function payeeWallet(freelancer: any): string {
  if (!freelancer?.walletAddress) {
    throw Object.assign(
      new Error('Payee has no settlement wallet — they must be verified (or given a wallet address) before they can be paid.'),
      { statusCode: 409 },
    );
  }
  return freelancer.walletAddress;
}

// Who is asking. Every public entry point takes one so the payment module scopes
// its reads and writes the way the rest of the backend already does (invoices,
// pay-runs, schedules, payout accounts, disputes all check ownership).
export interface Actor {
  id: string;
  role: Role;
}

const forbidden = (msg: string) => Object.assign(new Error(msg), { statusCode: 403 });

// Read access: an admin sees everything; otherwise the caller must be the payer
// or the payee on this payment.
export function assertParty(p: { companyId: string; freelancerId: string }, actor: Actor): void {
  if (actor.role === 'ADMIN') return;
  if (p.companyId !== actor.id && p.freelancerId !== actor.id) {
    throw forbidden('Not a party to this payment');
  }
}

// Write access: an admin may act on any payment; otherwise only the paying
// company may confirm, retry, release or refund it. A payee is a party (they can
// read it) but must never be able to move their own money.
export function assertPayer(p: { companyId: string }, actor: Actor): void {
  if (actor.role === 'ADMIN') return;
  if (p.companyId !== actor.id) throw forbidden('Only the paying company can act on this payment');
}

// Advance a payment to a new state: persist, append the timeline step, audit,
// broadcast to payer + payee (and admins, handled by the hub).
async function transition(
  paymentId: string,
  to: PaymentState,
  opts: { actor: string; timelineKey?: string; txHash?: string; extra?: Record<string, unknown> } = { actor: 'system' },
) {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  assertTransition(p.state as PaymentState, to);

  const step = TIMELINE_STEPS.find((s) => s.key === opts.timelineKey);
  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      state: to,
      ...(opts.txHash && to === 'FUNDED' ? { txHashFund: opts.txHash } : {}),
      ...(opts.txHash && to === 'COMPLETED' ? { txHashRelease: opts.txHash } : {}),
      ...(step
        ? {
            timeline: {
              create: {
                key: step.key,
                label: step.label,
                state: to,
                actor: opts.actor,
                txHash: opts.txHash ?? null,
                detail: (opts.extra ?? undefined) as never,
              },
            },
          }
        : {}),
    },
    include: { timeline: { orderBy: { at: 'asc' } } },
  });

  await audit(opts.actor, `PAYMENT_${to}`, `payment:${paymentId}`, { state: p.state }, { state: to });
  emitToUsers([updated.companyId, updated.freelancerId], {
    type: 'payment.state',
    paymentId,
    state: to,
    timeline: updated.timeline.map((t) => ({
      key: t.key,
      label: t.label,
      state: t.state as PaymentState | null,
      at: t.at.toISOString(),
      actor: t.actor,
      txHash: t.txHash,
      detail: (t.detail ?? undefined) as Record<string, unknown> | undefined,
    })),
  });
  return updated;
}

// 1. Create a payment: persist DRAFT, run compliance, land in RATE_LOCKED-ready
//    (COMPLIANCE_CHECK) or FLAGGED/REJECTED. Returns the payment + a fresh quote.
export async function createPayment(companyId: string, input: CreatePaymentInput) {
  const payee = await prisma.user.findUniqueOrThrow({
    where: { id: input.payeeId },
    include: { freelancer: true },
  });
  // Validate the payee BEFORE writing anything. Creating a payment (and a
  // compliance decision) against a company account or an unverified freelancer
  // left rows that could never settle: the EscrowVault verified-party gate
  // rejects an unverified payee, so the money had nowhere to go.
  if (payee.role !== 'FREELANCER') {
    throw Object.assign(new Error('Payee must be a freelancer account'), { statusCode: 400 });
  }
  if (payee.freelancer?.kycStatus !== 'VERIFIED') {
    throw Object.assign(
      new Error(`Payee is not verified (KYC ${payee.freelancer?.kycStatus ?? 'PENDING'}) — they must complete verification first`),
      { statusCode: 409 },
    );
  }

  const payment = await prisma.payment.create({
    data: {
      companyId,
      freelancerId: input.payeeId,
      escrowMode: input.escrowMode ?? 'INSTANT',
      srcCurrency: input.srcCurrency,
      dstCurrency: input.dstCurrency,
      srcAmountMinor: input.srcAmountMinor,
      purposeCode: input.purposeCode,
      invoiceRef: input.invoiceRef ?? null,
      state: 'DRAFT',
      timeline: { create: { key: 'CREATED', label: 'Payment created', state: 'DRAFT', actor: companyId } },
    },
  });

  // Compliance evaluation.
  const outcome = await getComplianceEngine()({
    srcCurrency: input.srcCurrency,
    dstCurrency: input.dstCurrency,
    srcAmountMinor: input.srcAmountMinor,
    purposeCode: input.purposeCode,
    payerId: companyId,
    payeeId: input.payeeId,
  });

  const anchor = await getSettlement().anchorDecision(outcome.decisionHash);
  const decision = await prisma.complianceDecision.create({
    data: {
      paymentId: payment.id,
      verdict: outcome.verdict,
      ruleResults: outcome.ruleResults as never,
      agentExplanation: outcome.agentExplanation,
      anchorTxHash: anchor.txHash,
    },
  });
  await prisma.payment.update({ where: { id: payment.id }, data: { complianceDecisionId: decision.id } });

  // Raise durable fraud/anomaly alerts (velocity/structuring/outlier/sanctions).
  await raiseAlertsFromRules(payment.id, outcome.ruleResults);

  // Always enter COMPLIANCE_CHECK first, then branch to FLAGGED/REJECTED so every
  // transition is legal (DRAFT only leads to COMPLIANCE_CHECK).
  await transition(payment.id, 'COMPLIANCE_CHECK', {
    actor: 'agent',
    timelineKey: outcome.verdict === 'APPROVE' ? 'COMPLIANCE_APPROVED' : undefined,
    extra: { verdict: outcome.verdict },
  });
  if (outcome.verdict === 'FLAG') {
    await transition(payment.id, 'FLAGGED', { actor: 'agent', extra: { verdict: outcome.verdict } });
    // AI adjudication: triage the flag so a human only sees genuine exceptions.
    if (env.AI_ADJUDICATION) {
      try {
        const company = await prisma.user.findUniqueOrThrow({ where: { id: companyId } });
        const adj = await adjudicate({
          ruleResults: outcome.ruleResults,
          facts: {
            payerName: company.name,
            payeeName: payee.name,
            payeeCountry: payee.country,
            amount: `${input.srcCurrency} ${(input.srcAmountMinor / 100).toFixed(2)}`,
            amountUsdMinor: toUsdMinorApprox(input.srcAmountMinor, input.srcCurrency),
            purposeCode: input.purposeCode ?? null,
          },
        });
        const act = resolveAction(adj);
        await prisma.complianceDecision.update({
          where: { id: decision.id },
          data: { reviewedBy: `ai:${adj.by}`, reviewNote: `[${act} · ${(adj.confidence * 100) | 0}% confidence] ${adj.rationale}` },
        });
        if (act === 'AUTO_CLEAR') {
          await transition(payment.id, 'COMPLIANCE_CHECK', { actor: 'ai-adjudicator', timelineKey: 'COMPLIANCE_APPROVED', extra: { aiAdjudication: act, confidence: adj.confidence } });
        } else if (act === 'AUTO_REJECT') {
          await transition(payment.id, 'REJECTED', { actor: 'ai-adjudicator', extra: { aiAdjudication: act, confidence: adj.confidence } });
        } // ESCALATE: stays FLAGGED for the human officer queue.
        await audit('ai-adjudicator', `PAYMENT_ADJUDICATED_${act}`, `payment:${payment.id}`, null, { confidence: adj.confidence, by: adj.by });
      } catch {
        /* any failure: leave FLAGGED for a human — never auto-act on error */
      }
    }
  } else if (outcome.verdict === 'REJECT') {
    await transition(payment.id, 'REJECTED', { actor: 'agent', extra: { verdict: outcome.verdict } });
  }

  const quote = await createQuote(pairOf(input.srcCurrency, input.dstCurrency), input.srcAmountMinor);
  return { payment: await getPaymentInternal(payment.id), quote, decision, payeeWallet: payee.walletAddress };
}

// 2. Confirm: validate the locked quote, move to RATE_LOCKED -> FUNDED (on-chain),
//    then auto SETTLING -> COMPLETED.
export async function confirmPayment(paymentId: string, actor: Actor, quoteId: string) {
  const actorId = actor.id;
  const p = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { freelancer: true, decision: true },
  });
  assertPayer(p, actor);
  if (p.state !== 'COMPLIANCE_CHECK' && p.state !== 'FLAGGED') {
    throw Object.assign(new Error(`Cannot confirm a payment in state ${p.state}`), { statusCode: 409 });
  }
  const quote = getQuote(quoteId);
  if (!quote || !isQuoteValid(quote)) {
    throw Object.assign(new Error('Quote missing or expired — request a new quote'), { statusCode: 409 });
  }

  const fx = await prisma.fxRate.create({
    data: { pair: quote.pair, midRate: quote.midRate, lockedRate: quote.midRate, lockedUntil: new Date(quote.expiresAt), source: 'fx-quote' },
  });
  await prisma.payment.update({
    where: { id: paymentId },
    data: { fxRateId: fx.id, dstAmountMinor: quote.payeeReceivesMinor, feeAmountMinor: quote.feeMinor },
  });
  await transition(paymentId, 'RATE_LOCKED', { actor: actorId, timelineKey: 'RATE_LOCKED' });

  // Payout-destination gate: the payee must have an active account in the
  // destination currency, or the money has nowhere to land. This is a real
  // unhappy path (PAYOUT_FAILED) — the payee adds an account and the company retries.
  if (!(await hasActivePayoutAccount(p.freelancerId, p.dstCurrency))) {
    await transition(paymentId, 'PAYOUT_FAILED', {
      actor: 'system',
      extra: { reason: `Payee has no active ${p.dstCurrency} payout account.` },
    });
    return getPaymentInternal(paymentId);
  }

  // Fund escrow on-chain (simulated until P1 swaps in real settlement).
  const complianceHash = keccak256(toUtf8(p.decision?.id ?? paymentId));
  const funded = await getSettlement().fund(
    paymentId,
    payeeWallet(p.freelancer),
    p.srcAmountMinor,
    quote.feeMinor,
    complianceHash,
  );
  await prisma.payment.update({ where: { id: paymentId }, data: { escrowId: funded.escrowId } });
  await transition(paymentId, 'FUNDED', { actor: actorId, timelineKey: 'FUNDED', txHash: funded.txHash });

  // FR-2.2: a HOLD escrow stops here — funded at gig start, released only when
  // the company approves the work (POST /payments/:id/release). INSTANT (the
  // default, and the demo's one-click payout) settles straight through.
  if (p.escrowMode === 'HOLD') {
    return getPaymentInternal(paymentId);
  }

  await settleFundedPayment(paymentId, funded.escrowId, 'platform');
  return getPaymentInternal(paymentId);
}

// The off-ramp "last mile": after on-chain release, deliver the settled value to the
// payee as INR (or their dst currency) through the payout rail — a UPI push to their
// VPA or a bank credit — and record how it landed (payoutMethod + railRef) for the
// FIRC and the "credited to <vpa>" UI. Best-effort: the pre-funding gate already
// guaranteed an active destination, so a missing account here is only defensive and
// leaves the prior generic behaviour. Simulated by default; a real PA-CB rail swaps in
// via setPayoutRail() with no orchestrator change.
async function creditPayee(paymentId: string): Promise<Record<string, unknown> | undefined> {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p) return undefined;
  const acct = await prisma.payoutAccount.findFirst({
    where: { userId: p.freelancerId, currency: p.dstCurrency, active: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!acct) return undefined;
  const result = await getPayoutRail().execute({
    paymentId,
    amountMinorInr: p.dstAmountMinor ?? 0,
    destination: destinationFromAccount(acct),
    purposeCode: p.purposeCode,
    reference: paymentId,
  });
  await prisma.payment.update({
    where: { id: paymentId },
    data: { payoutMethod: acct.method ?? 'BANK', payoutRailRef: result.railRef },
  });
  // Detail for the CREDITED timeline step: powers the "credited to <vpa>" card and,
  // for UPI, the scannable upi:// intent / deep link on the payment detail page.
  return {
    method: acct.method ?? 'BANK',
    railRef: result.railRef,
    ...(result.upiIntent ? { upiIntent: result.upiIntent } : {}),
    ...(acct.method === 'UPI' && acct.vpa ? { vpaMasked: maskVpa(acct.vpa) } : {}),
    ...(acct.method !== 'UPI' && acct.accountNumberMasked ? { accountMasked: acct.accountNumberMasked } : {}),
  };
}

// SETTLING -> COMPLETED -> credited. Shared by the straight-through confirm, the
// payout retry, and the explicit release-on-approval path so all three produce
// exactly the same timeline.
async function settleFundedPayment(paymentId: string, escrowId: string, actor: string) {
  await transition(paymentId, 'SETTLING', { actor: 'settlement', timelineKey: 'SETTLING' });
  const released = await getSettlement().release(escrowId);
  await transition(paymentId, 'COMPLETED', { actor, timelineKey: 'RELEASED', txHash: released.txHash });
  // 'CREDITED' is the off-ramp confirmation on the same COMPLETED state: the rail
  // pushes the INR to the payee's UPI id / bank and records how it landed.
  const credited = await creditPayee(paymentId);
  await appendStep(paymentId, 'CREDITED', 'off-ramp', credited);
  await markInvoicePaidByPayment(paymentId); // no-op unless this payment came from an invoice
}

// Retry a payout that failed for lack of a destination account. Re-checks the
// gate, then funds + settles. Needs a fresh quote (the old lock is gone).
export async function retryPayout(paymentId: string, actor: Actor, quoteId: string) {
  const actorId = actor.id;
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { freelancer: true, decision: true } });
  assertPayer(p, actor);
  if (p.state !== 'PAYOUT_FAILED') {
    throw Object.assign(new Error(`Only a PAYOUT_FAILED payment can be retried (state ${p.state})`), { statusCode: 409 });
  }
  if (!(await hasActivePayoutAccount(p.freelancerId, p.dstCurrency))) {
    throw Object.assign(new Error(`Payee still has no active ${p.dstCurrency} payout account.`), { statusCode: 409 });
  }
  const quote = getQuote(quoteId);
  if (!quote || !isQuoteValid(quote)) throw Object.assign(new Error('Quote missing or expired — request a new quote'), { statusCode: 409 });

  await transition(paymentId, 'RATE_LOCKED', { actor: actorId, timelineKey: 'RATE_LOCKED', extra: { retry: true } });
  const complianceHash = keccak256(toUtf8(p.decision?.id ?? paymentId));
  const funded = await getSettlement().fund(paymentId, payeeWallet(p.freelancer), p.srcAmountMinor, quote.feeMinor, complianceHash);
  await prisma.payment.update({ where: { id: paymentId }, data: { escrowId: funded.escrowId, dstAmountMinor: quote.payeeReceivesMinor, feeAmountMinor: quote.feeMinor } });
  await transition(paymentId, 'FUNDED', { actor: actorId, timelineKey: 'FUNDED', txHash: funded.txHash });
  if (p.escrowMode === 'HOLD') return getPaymentInternal(paymentId);
  await settleFundedPayment(paymentId, funded.escrowId, 'platform');
  return getPaymentInternal(paymentId);
}

export async function releasePayment(paymentId: string, actor: Actor) {
  const actorId = actor.id;
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  assertPayer(p, actor);
  if (p.state !== 'FUNDED' && p.state !== 'SETTLING') {
    throw Object.assign(new Error(`Cannot release from ${p.state}`), { statusCode: 409 });
  }
  if (p.state === 'SETTLING') {
    // Already settling — just finish it.
    const released = await getSettlement().release(p.escrowId ?? '0x');
    await transition(paymentId, 'COMPLETED', { actor: actorId, timelineKey: 'RELEASED', txHash: released.txHash });
    const credited = await creditPayee(paymentId);
    await appendStep(paymentId, 'CREDITED', 'off-ramp', credited);
    await markInvoicePaidByPayment(paymentId);
  } else {
    // Work approved on a held escrow — same tail as a straight-through payment.
    await settleFundedPayment(paymentId, p.escrowId ?? '0x', actorId);
  }
  return getPaymentInternal(paymentId);
}

// Admin resolves a FLAGGED payment. REJECT -> REJECTED; APPROVE clears the flag
// and records the review so the company can confirm (confirm accepts FLAGGED too,
// but APPROVE moves it to COMPLIANCE_CHECK to signal the queue is cleared).
export async function adminResolveFlag(paymentId: string, action: 'APPROVE' | 'REJECT', note: string, adminId: string) {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (p.state !== 'FLAGGED') {
    throw Object.assign(new Error(`Payment is not flagged (state ${p.state})`), { statusCode: 409 });
  }
  await prisma.complianceDecision.updateMany({
    where: { paymentId },
    data: { reviewedBy: adminId, reviewNote: note },
  });
  if (action === 'REJECT') {
    await transition(paymentId, 'REJECTED', { actor: adminId, extra: { reviewNote: note } });
  } else {
    await transition(paymentId, 'COMPLIANCE_CHECK', { actor: adminId, timelineKey: 'COMPLIANCE_APPROVED', extra: { reviewNote: note, resolved: true } });
  }
  return getPaymentInternal(paymentId);
}

// --- Dispute transitions (called by the disputes module) ---
// Put a completed payment on hold while a dispute is open.
export async function holdForDispute(paymentId: string, actorId: string) {
  await transition(paymentId, 'DISPUTED', { actor: actorId, extra: { reason: 'dispute opened' } });
  return getPaymentInternal(paymentId);
}

// Resolve a dispute in the payer's favour: refund the escrow, mark REVERSED.
export async function reverseDisputed(paymentId: string, actorId: string) {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const refunded = await getSettlement().refund(p.escrowId ?? '0x');
  await transition(paymentId, 'REVERSED', { actor: actorId, txHash: refunded.txHash, extra: { txHash: refunded.txHash } });
  return getPaymentInternal(paymentId);
}

// Resolve a dispute in the payee's favour: restore the completed payment.
export async function dismissDisputed(paymentId: string, actorId: string) {
  await transition(paymentId, 'COMPLETED', { actor: actorId, extra: { disputeDismissed: true } });
  return getPaymentInternal(paymentId);
}

export async function refundPayment(paymentId: string, actor: Actor) {
  const actorId = actor.id;
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  assertPayer(p, actor);
  const refunded = await getSettlement().refund(p.escrowId ?? '0x');
  await transition(paymentId, 'REFUNDED', { actor: actorId, extra: { txHash: refunded.txHash } });
  return getPaymentInternal(paymentId);
}

// Sweep rate locks that have run past their validity window. RATE_LOCKED ->
// EXPIRED was declared in the state machine from the start but nothing ever
// produced it, so a stale lock just sat there and could still be funded at a rate
// the company never agreed to. Runs on a timer (index.ts) and on demand
// (POST /admin/expire-locks). Returns the ids it expired.
export async function expireStaleRateLocks(now: Date = new Date()): Promise<string[]> {
  const stale = await prisma.payment.findMany({
    where: { state: 'RATE_LOCKED', fxRate: { lockedUntil: { lt: now } } },
    select: { id: true },
  });
  const expired: string[] = [];
  for (const { id } of stale) {
    try {
      await transition(id, 'EXPIRED', { actor: 'system', extra: { reason: 'rate lock expired' } });
      expired.push(id);
    } catch {
      // Raced with a confirm that already moved it on — leave it alone.
    }
  }
  return expired;
}

async function appendStep(paymentId: string, key: string, actor: string, detail?: Record<string, unknown>) {
  const step = TIMELINE_STEPS.find((s) => s.key === key)!;
  await prisma.timelineStep.create({
    data: { paymentId, key: step.key, label: step.label, state: step.state, actor, detail: (detail ?? undefined) as never },
  });
}

// Public read — enforces that the caller is a party (or an admin).
export async function getPayment(id: string, requester: Actor) {
  const p = await prisma.payment.findUniqueOrThrow({
    where: { id },
    include: { timeline: { orderBy: { at: 'asc' } }, decision: true, company: { select: { name: true, walletAddress: true } }, freelancer: { select: { name: true, walletAddress: true } } },
  });
  assertParty(p, requester);
  return serialize(p);
}

// Internal read — no party check. Only for callers that have ALREADY authorized
// the actor (the orchestrator returning the payment it just mutated, and the
// pay-run summariser, which checks run ownership before it gets here). Never
// expose this straight off a route.
export async function getPaymentInternal(id: string) {
  const p = await prisma.payment.findUniqueOrThrow({
    where: { id },
    include: { timeline: { orderBy: { at: 'asc' } }, decision: true, company: { select: { name: true, walletAddress: true } }, freelancer: { select: { name: true, walletAddress: true } } },
  });
  return serialize(p);
}

export async function listPayments(userId: string, role: string) {
  const where = role === 'ADMIN' ? {} : role === 'COMPANY' ? { companyId: userId } : { freelancerId: userId };
  const rows = await prisma.payment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { timeline: { orderBy: { at: 'asc' } }, company: { select: { name: true, walletAddress: true } }, freelancer: { select: { name: true, walletAddress: true } } },
  });
  return rows.map(serialize);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(p: any) {
  return {
    id: p.id,
    companyId: p.companyId,
    companyName: p.company?.name ?? null,
    // The settlement wallets this payment moved value between. Both parties see
    // both names already; the addresses are public chain data by construction.
    companyWallet: p.company?.walletAddress ?? null,
    freelancerId: p.freelancerId,
    freelancerName: p.freelancer?.name ?? null,
    freelancerWallet: p.freelancer?.walletAddress ?? null,
    srcCurrency: p.srcCurrency,
    dstCurrency: p.dstCurrency,
    srcAmountMinor: p.srcAmountMinor,
    dstAmountMinor: p.dstAmountMinor,
    feeAmountMinor: p.feeAmountMinor,
    fxRateId: p.fxRateId,
    purposeCode: p.purposeCode,
    invoiceRef: p.invoiceRef,
    state: p.state,
    escrowId: p.escrowId,
    escrowMode: p.escrowMode,
    complianceDecisionId: p.complianceDecisionId,
    txHashFund: p.txHashFund,
    txHashRelease: p.txHashRelease,
    payoutMethod: p.payoutMethod ?? null,
    payoutRailRef: p.payoutRailRef ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    timeline: (p.timeline ?? []).map((t: any) => ({
      key: t.key,
      label: t.label,
      state: t.state,
      at: t.at.toISOString(),
      actor: t.actor,
      txHash: t.txHash,
      detail: t.detail ?? undefined,
    })),
  };
}
