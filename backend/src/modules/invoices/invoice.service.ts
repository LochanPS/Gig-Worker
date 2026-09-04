// Invoice service (step 9). A freelancer raises a payment request; the company
// approves it, which creates a payment draft that flows into the SAME orchestrator
// pipeline (compliance -> quote -> confirm -> settle). Reuse, not new machinery.
import type { CreateInvoiceInput } from '@gigbridge/shared';
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';
import { emitToUser } from '../../lib/ws.js';
import { createPayment } from '../payments/payment.service.js';
import type { PurposeCode, Currency } from '@gigbridge/shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(inv: any) {
  return {
    id: inv.id,
    freelancerId: inv.freelancerId,
    companyId: inv.companyId,
    amountMinor: inv.amountMinor,
    currency: inv.currency,
    memo: inv.memo,
    status: inv.status,
    paymentId: inv.paymentId,
    createdAt: inv.createdAt.toISOString(),
    ...(inv.freelancer ? { freelancerName: inv.freelancer.name } : {}),
    ...(inv.company ? { companyName: inv.company.name } : {}),
  };
}

// Freelancer raises an invoice against a company.
export async function createInvoice(freelancerId: string, input: CreateInvoiceInput) {
  const company = await prisma.user.findUniqueOrThrow({ where: { id: input.companyId } });
  if (company.role !== 'COMPANY') {
    throw Object.assign(new Error('Invoice must be addressed to a company'), { statusCode: 400 });
  }
  const inv = await prisma.invoice.create({
    data: {
      freelancerId,
      companyId: input.companyId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      memo: input.memo,
      status: 'SENT',
    },
  });
  await audit(freelancerId, 'INVOICE_CREATED', `invoice:${inv.id}`, null, { companyId: input.companyId, amountMinor: input.amountMinor });
  await notify(input.companyId, 'INVOICE_RECEIVED', `New invoice for ${input.currency} ${(input.amountMinor / 100).toFixed(2)} — "${input.memo}"`);
  return serialize(inv);
}

// Company approves an invoice -> spins up a payment draft (dst currency = company's
// home settlement currency defaulting to INR for the demo) through the orchestrator.
export async function approveInvoice(invoiceId: string, companyId: string) {
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  if (inv.companyId !== companyId) {
    throw Object.assign(new Error('Not your invoice to approve'), { statusCode: 403 });
  }
  if (inv.status !== 'SENT') {
    throw Object.assign(new Error(`Invoice already ${inv.status}`), { statusCode: 409 });
  }

  // Kick off the payment. Freelancer receives in INR by default (payout preference
  // can convert or hold; the orchestrator/FX handle the rate).
  const result = await createPayment(companyId, {
    payeeId: inv.freelancerId,
    srcCurrency: inv.currency as Currency,
    dstCurrency: 'INR',
    srcAmountMinor: inv.amountMinor,
    purposeCode: 'P0802' as PurposeCode,
    invoiceRef: inv.id,
  });

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'APPROVED', paymentId: result.payment.id },
  });
  await audit(companyId, 'INVOICE_APPROVED', `invoice:${invoiceId}`, { status: 'SENT' }, { status: 'APPROVED', paymentId: result.payment.id });
  await notify(inv.freelancerId, 'INVOICE_APPROVED', `Your invoice "${inv.memo}" was approved — payment ${result.payment.state}.`);
  return { invoice: serialize(updated), payment: result.payment, quote: result.quote };
}

// Mark the invoice PAID once its payment completes (called by the orchestrator hook
// or on demand). Kept idempotent.
export async function markInvoicePaidByPayment(paymentId: string) {
  await prisma.invoice.updateMany({ where: { paymentId, status: 'APPROVED' }, data: { status: 'PAID' } });
}

export async function listInvoices(userId: string, role: string) {
  const where = role === 'COMPANY' ? { companyId: userId } : role === 'FREELANCER' ? { freelancerId: userId } : {};
  const rows = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { freelancer: true, company: true },
  });
  return rows.map(serialize);
}

async function notify(userId: string, kind: string, message: string) {
  const n = await prisma.notification.create({ data: { userId, kind, message } });
  emitToUser(userId, {
    type: 'notification.new',
    notification: { id: n.id, userId, kind, message, read: false, createdAt: n.createdAt.toISOString() },
  });
}
