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
import { getSettlement } from '../settlement/settlement.interface.js';
import type { PaymentState } from '@gigbridge/shared';
import type { CreatePaymentInput } from '@gigbridge/shared';

function pairOf(src: string, dst: string): string {
  return `${src}${dst}`;
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
  const payee = await prisma.user.findUniqueOrThrow({ where: { id: input.payeeId } });
  const payment = await prisma.payment.create({
    data: {
      companyId,
      freelancerId: input.payeeId,
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

  const to: PaymentState = outcome.verdict === 'APPROVE' ? 'COMPLIANCE_CHECK' : outcome.verdict === 'FLAG' ? 'FLAGGED' : 'REJECTED';
  await transition(payment.id, to, {
    actor: 'agent',
    timelineKey: to === 'COMPLIANCE_CHECK' ? 'COMPLIANCE_APPROVED' : undefined,
    extra: { verdict: outcome.verdict },
  });

  const quote = await createQuote(pairOf(input.srcCurrency, input.dstCurrency), input.srcAmountMinor);
  return { payment: await getPayment(payment.id, companyId), quote, decision, payeeWallet: payee.walletAddress };
}

// 2. Confirm: validate the locked quote, move to RATE_LOCKED -> FUNDED (on-chain),
//    then auto SETTLING -> COMPLETED.
export async function confirmPayment(paymentId: string, actorId: string, quoteId: string) {
  const p = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { freelancer: true, decision: true },
  });
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

  // Fund escrow on-chain (simulated until P1 swaps in real settlement).
  const complianceHash = keccak256(toUtf8(p.decision?.id ?? paymentId));
  const funded = await getSettlement().fund(
    paymentId,
    p.freelancer.walletAddress ?? '0xpayee',
    p.srcAmountMinor,
    quote.feeMinor,
    complianceHash,
  );
  await prisma.payment.update({ where: { id: paymentId }, data: { escrowId: funded.escrowId } });
  await transition(paymentId, 'FUNDED', { actor: actorId, timelineKey: 'FUNDED', txHash: funded.txHash });

  await transition(paymentId, 'SETTLING', { actor: 'settlement', timelineKey: 'SETTLING' });
  const released = await getSettlement().release(funded.escrowId);
  await transition(paymentId, 'COMPLETED', { actor: 'platform', timelineKey: 'RELEASED', txHash: released.txHash });
  // 'CREDITED' is the off-ramp confirmation on the same COMPLETED state.
  await appendStep(paymentId, 'CREDITED', 'off-ramp');

  return getPayment(paymentId, actorId);
}

export async function releasePayment(paymentId: string, actorId: string) {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (p.state !== 'FUNDED' && p.state !== 'SETTLING') {
    throw Object.assign(new Error(`Cannot release from ${p.state}`), { statusCode: 409 });
  }
  if (p.state === 'FUNDED') await transition(paymentId, 'SETTLING', { actor: actorId, timelineKey: 'SETTLING' });
  const released = await getSettlement().release(p.escrowId ?? '0x');
  await transition(paymentId, 'COMPLETED', { actor: actorId, timelineKey: 'RELEASED', txHash: released.txHash });
  return getPayment(paymentId, actorId);
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
  return getPayment(paymentId, adminId);
}

export async function refundPayment(paymentId: string, actorId: string) {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const refunded = await getSettlement().refund(p.escrowId ?? '0x');
  await transition(paymentId, 'REFUNDED', { actor: actorId, extra: { txHash: refunded.txHash } });
  return getPayment(paymentId, actorId);
}

async function appendStep(paymentId: string, key: string, actor: string) {
  const step = TIMELINE_STEPS.find((s) => s.key === key)!;
  await prisma.timelineStep.create({ data: { paymentId, key: step.key, label: step.label, state: step.state, actor } });
}

export async function getPayment(id: string, requesterId?: string) {
  const p = await prisma.payment.findUniqueOrThrow({
    where: { id },
    include: { timeline: { orderBy: { at: 'asc' } }, decision: true },
  });
  return serialize(p);
}

export async function listPayments(userId: string, role: string) {
  const where = role === 'ADMIN' ? {} : role === 'COMPANY' ? { companyId: userId } : { freelancerId: userId };
  const rows = await prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, include: { timeline: { orderBy: { at: 'asc' } } } });
  return rows.map(serialize);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(p: any) {
  return {
    id: p.id,
    companyId: p.companyId,
    freelancerId: p.freelancerId,
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
    complianceDecisionId: p.complianceDecisionId,
    txHashFund: p.txHashFund,
    txHashRelease: p.txHashRelease,
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
