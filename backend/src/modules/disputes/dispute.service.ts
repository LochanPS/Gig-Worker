// Disputes & reversals — the unhappy path after a payout completes. Either party
// can open a dispute on a COMPLETED payment; it holds the payment in DISPUTED
// until an admin resolves it: REFUND reverses the escrow (-> REVERSED), DISMISS
// restores it (-> COMPLETED). Real money spends real time here; the demo skipped it.
import type { RaiseDisputeInput, Role } from '@gigbridge/shared';
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';
import { emitToAdmins } from '../../lib/ws.js';
import { holdForDispute, reverseDisputed, dismissDisputed } from '../payments/payment.service.js';
import { notify } from '../notifications/notification.service.js';
import { env } from '../../lib/env.js';
import { adjudicateDispute, resolveDisputeAction } from '../agent/dispute-adjudicator.js';

// Rough src-minor → USD-minor for the triage value ceiling (not a settlement rate).
function toUsdMinorApprox(amountMinor: number, ccy: string): number {
  const perUsd: Record<string, number> = { USD: 1, EUR: 1.08, INR: 1 / 83 };
  return Math.round(amountMinor * (perUsd[ccy] ?? 1));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(d: any) {
  return {
    id: d.id,
    paymentId: d.paymentId,
    raisedById: d.raisedById,
    raisedByRole: d.raisedByRole as Role,
    reason: d.reason,
    status: d.status,
    resolutionNote: d.resolutionNote ?? null,
    resolvedById: d.resolvedById ?? null,
    resolvedByAgent: d.resolvedByAgent ?? null,
    createdAt: d.createdAt.toISOString(),
    resolvedAt: d.resolvedAt ? d.resolvedAt.toISOString() : null,
  };
}

export async function raiseDispute(userId: string, role: Role, input: RaiseDisputeInput) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: input.paymentId } });
  const isParty = payment.companyId === userId || payment.freelancerId === userId;
  if (!isParty && role !== 'ADMIN') throw Object.assign(new Error('Not a party to this payment'), { statusCode: 403 });
  if (payment.state !== 'COMPLETED') {
    throw Object.assign(new Error(`Only a COMPLETED payment can be disputed (state ${payment.state})`), { statusCode: 409 });
  }
  const open = await prisma.dispute.findFirst({ where: { paymentId: input.paymentId, status: 'OPEN' } });
  if (open) throw Object.assign(new Error('A dispute is already open on this payment'), { statusCode: 409 });

  const dispute = await prisma.dispute.create({
    data: { paymentId: input.paymentId, raisedById: userId, raisedByRole: role, reason: input.reason },
  });
  await holdForDispute(input.paymentId, userId);
  await audit(userId, 'DISPUTE_RAISED', `dispute:${dispute.id}`, null, { paymentId: input.paymentId });

  // Notify the counterparty + admins.
  const counterparty = payment.companyId === userId ? payment.freelancerId : payment.companyId;
  await notify(counterparty, 'DISPUTE_RAISED', `A dispute was opened on a payment: "${input.reason}"`);
  emitToAdmins({ type: 'notification.new', notification: { id: dispute.id, userId: 'admins', kind: 'DISPUTE_RAISED', message: `Dispute opened on payment ${input.paymentId.slice(0, 8)}`, read: false, createdAt: dispute.createdAt.toISOString() } });

  // AI dispute triage (roadmap #1): recommend REFUND/DISMISS with confidence and
  // auto-resolve the confident, low-risk cases; ambiguous / serious / high-value
  // disputes stay OPEN for a human with the recommendation attached. Mirrors the
  // payment adjudicator, is confidence-gated, and never blocks the raise on failure.
  if (env.AI_ADJUDICATION) {
    try {
      const [payer, payee] = await Promise.all([
        prisma.user.findUnique({ where: { id: payment.companyId } }),
        prisma.user.findUnique({ where: { id: payment.freelancerId } }),
      ]);
      const adj = await adjudicateDispute({
        reason: input.reason,
        raisedByRole: role,
        facts: {
          payerName: payer?.name ?? 'payer',
          payeeName: payee?.name ?? 'payee',
          amountUsdMinor: toUsdMinorApprox(payment.srcAmountMinor, payment.srcCurrency),
        },
      });
      const act = resolveDisputeAction(adj);
      const note = `[${act} · ${(adj.confidence * 100) | 0}% confidence] ${adj.rationale}`;
      if (act === 'AUTO_REFUND') {
        await resolveDispute(dispute.id, null, 'REFUND', note, `ai:${adj.by}`);
      } else if (act === 'AUTO_DISMISS') {
        await resolveDispute(dispute.id, null, 'DISMISS', note, `ai:${adj.by}`);
      } else {
        // ESCALATE: keep OPEN, attach the recommendation for the human queue.
        await prisma.dispute.update({ where: { id: dispute.id }, data: { resolutionNote: `AI recommendation: ${note}` } });
      }
      await audit(`ai:${adj.by}`, `DISPUTE_ADJUDICATED_${act}`, `dispute:${dispute.id}`, null, { confidence: adj.confidence, action: act });
    } catch (err) {
      // Never auto-act on error: the dispute stays OPEN for a human. But do NOT stay
      // silent — a swallowed failure here looks identical to "the agent chose not to
      // act", which hides a broken triage path behind a plausible outcome.
      console.warn(
        `dispute ${dispute.id}: AI triage failed, left OPEN for a human — ${(err as Error).message}`,
      );
    }
    return serialize(await prisma.dispute.findUniqueOrThrow({ where: { id: dispute.id } }));
  }

  return serialize(dispute);
}

/**
 * Resolve a dispute. `adminId` is a real User id for a human resolver; the AI
 * adjudicator passes null plus `agent` (e.g. 'ai:ai-heuristic'), because
 * Dispute.resolvedById is a foreign key and would reject a non-user string.
 */
export async function resolveDispute(
  disputeId: string,
  adminId: string | null,
  action: 'REFUND' | 'DISMISS',
  note: string,
  agent?: string,
) {
  const actor = agent ?? adminId ?? 'system';
  const dispute = await prisma.dispute.findUniqueOrThrow({ where: { id: disputeId }, include: { payment: true } });
  if (dispute.status !== 'OPEN') throw Object.assign(new Error(`Dispute already ${dispute.status}`), { statusCode: 409 });

  if (action === 'REFUND') {
    await reverseDisputed(dispute.paymentId, actor);
  } else {
    await dismissDisputed(dispute.paymentId, actor);
  }

  const updated = await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status: action === 'REFUND' ? 'RESOLVED_REFUND' : 'RESOLVED_DISMISS',
      resolutionNote: note,
      resolvedById: adminId,
      resolvedByAgent: agent ?? null,
      resolvedAt: new Date(),
    },
  });
  await audit(actor, 'DISPUTE_RESOLVED', `dispute:${disputeId}`, { status: 'OPEN' }, { action, note });

  const p = dispute.payment;
  const msg = action === 'REFUND' ? `Dispute resolved — payment reversed. ${note}` : `Dispute dismissed — payment stands. ${note}`;
  await notify(p.companyId, 'DISPUTE_RESOLVED', msg);
  await notify(p.freelancerId, 'DISPUTE_RESOLVED', msg);
  return serialize(updated);
}

export async function listDisputes(userId: string, role: Role) {
  const where =
    role === 'ADMIN'
      ? {}
      : { payment: { OR: [{ companyId: userId }, { freelancerId: userId }] } };
  const rows = await prisma.dispute.findMany({ where, orderBy: { createdAt: 'desc' } });
  return rows.map(serialize);
}

