// Disputes & reversals — the unhappy path after a payout completes. Either party
// can open a dispute on a COMPLETED payment; it holds the payment in DISPUTED
// until an admin resolves it: REFUND reverses the escrow (-> REVERSED), DISMISS
// restores it (-> COMPLETED). Real money spends real time here; the demo skipped it.
import type { RaiseDisputeInput, Role } from '@gigbridge/shared';
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';
import { emitToUser, emitToAdmins } from '../../lib/ws.js';
import { holdForDispute, reverseDisputed, dismissDisputed } from '../payments/payment.service.js';

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
  return serialize(dispute);
}

export async function resolveDispute(disputeId: string, adminId: string, action: 'REFUND' | 'DISMISS', note: string) {
  const dispute = await prisma.dispute.findUniqueOrThrow({ where: { id: disputeId }, include: { payment: true } });
  if (dispute.status !== 'OPEN') throw Object.assign(new Error(`Dispute already ${dispute.status}`), { statusCode: 409 });

  if (action === 'REFUND') {
    await reverseDisputed(dispute.paymentId, adminId);
  } else {
    await dismissDisputed(dispute.paymentId, adminId);
  }

  const updated = await prisma.dispute.update({
    where: { id: disputeId },
    data: { status: action === 'REFUND' ? 'RESOLVED_REFUND' : 'RESOLVED_DISMISS', resolutionNote: note, resolvedById: adminId, resolvedAt: new Date() },
  });
  await audit(adminId, 'DISPUTE_RESOLVED', `dispute:${disputeId}`, { status: 'OPEN' }, { action, note });

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

async function notify(userId: string, kind: string, message: string) {
  const n = await prisma.notification.create({ data: { userId, kind, message } });
  emitToUser(userId, {
    type: 'notification.new',
    notification: { id: n.id, userId, kind, message, read: false, createdAt: n.createdAt.toISOString() },
  });
}
