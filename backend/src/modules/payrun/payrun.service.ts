// Batch pay-run (FR-2.5): a company pays N freelancers in one action. This is
// NOT new settlement machinery — it fans out into N child Payments, each of which
// runs through the SAME orchestrator (compliance -> quote -> confirm -> settle).
// createPayRun runs one compliance evaluation per child and returns the run with
// every child's verdict; confirmPayRun then confirms only the APPROVED children
// (flagged ones wait for the admin queue, rejected ones are skipped).
import type { CreatePayRunInput, PayRunStatus, Verdict } from '@gigbridge/shared';
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';
import { createQuote } from '../fx/fx.service.js';
import { createPayment, confirmPayment, getPaymentInternal, type Actor } from '../payments/payment.service.js';

function pairOf(src: string, dst: string) {
  return `${src}${dst}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function summarize(run: any) {
  const payments = await prisma.payment.findMany({
    where: { payRunId: run.id },
    orderBy: { createdAt: 'asc' },
    include: { decision: true },
  });
  const verdictOf = (p: (typeof payments)[number]): Verdict | null => (p.decision?.verdict as Verdict) ?? null;
  const approvedCount = payments.filter((p) => verdictOf(p) === 'APPROVE').length;
  const flaggedCount = payments.filter((p) => verdictOf(p) === 'FLAG').length;
  const rejectedCount = payments.filter((p) => verdictOf(p) === 'REJECT').length;
  return {
    id: run.id,
    companyId: run.companyId,
    status: run.status as PayRunStatus,
    note: run.note ?? null,
    itemCount: payments.length,
    approvedCount,
    flaggedCount,
    rejectedCount,
    totalSrcMinor: payments.reduce((s, p) => s + p.srcAmountMinor, 0),
    createdAt: run.createdAt.toISOString(),
    payments: await Promise.all(payments.map((p) => getPaymentInternal(p.id))),
  };
}

// Create a run: one child payment per item, each compliance-checked. The run
// lands in REVIEWED (every child has a verdict) so the company can review before
// confirming.
export async function createPayRun(companyId: string, input: CreatePayRunInput) {
  const run = await prisma.payRun.create({ data: { companyId, note: input.note ?? null, status: 'DRAFT' } });

  for (const item of input.items) {
    const result = await createPayment(companyId, {
      payeeId: item.payeeId,
      srcCurrency: item.srcCurrency,
      dstCurrency: item.dstCurrency,
      srcAmountMinor: item.srcAmountMinor,
      purposeCode: item.purposeCode,
    });
    await prisma.payment.update({ where: { id: result.payment.id }, data: { payRunId: run.id } });
  }

  const reviewed = await prisma.payRun.update({ where: { id: run.id }, data: { status: 'REVIEWED' } });
  await audit(companyId, 'PAYRUN_CREATED', `payrun:${run.id}`, null, { items: input.items.length });
  return summarize(reviewed);
}

// Confirm a run: confirm every APPROVED child (fresh quote each) so they fund +
// settle. Flagged children are left for admin review; rejected are skipped. The
// run ends COMPLETED if every child was releasable, else PARTIAL.
export async function confirmPayRun(runId: string, companyId: string) {
  const run = await prisma.payRun.findUniqueOrThrow({ where: { id: runId } });
  if (run.companyId !== companyId) throw Object.assign(new Error('Not your pay-run'), { statusCode: 403 });
  if (run.status !== 'REVIEWED' && run.status !== 'PARTIAL') {
    throw Object.assign(new Error(`Pay-run already ${run.status}`), { statusCode: 409 });
  }

  const children = await prisma.payment.findMany({ where: { payRunId: runId }, include: { decision: true } });
  let confirmed = 0;
  let skipped = 0;
  for (const child of children) {
    const verdict = child.decision?.verdict as Verdict | undefined;
    // Confirmable when compliance approved (state COMPLIANCE_CHECK, not yet funded).
    if (verdict === 'APPROVE' && child.state === 'COMPLIANCE_CHECK') {
      const quote = await createQuote(pairOf(child.srcCurrency, child.dstCurrency), child.srcAmountMinor);
      await confirmPayment(child.id, { id: companyId, role: 'COMPANY' } satisfies Actor, quote.quoteId);
      confirmed++;
    } else {
      skipped++;
    }
  }

  const status: PayRunStatus = skipped === 0 ? 'COMPLETED' : confirmed === 0 ? 'REVIEWED' : 'PARTIAL';
  const updated = await prisma.payRun.update({ where: { id: runId }, data: { status } });
  await audit(companyId, 'PAYRUN_CONFIRMED', `payrun:${runId}`, { status: run.status }, { status, confirmed, skipped });
  return summarize(updated);
}

export async function listPayRuns(companyId: string) {
  const runs = await prisma.payRun.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  return Promise.all(runs.map(summarize));
}

export async function getPayRun(runId: string, companyId: string) {
  const run = await prisma.payRun.findUniqueOrThrow({ where: { id: runId } });
  if (run.companyId !== companyId) throw Object.assign(new Error('Not your pay-run'), { statusCode: 403 });
  return summarize(run);
}
