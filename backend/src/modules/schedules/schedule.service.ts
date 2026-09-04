// Recurring payouts / retainers. A schedule fires a normal Payment through the
// SAME orchestrator each cadence period, then advances nextRunAt. Approved runs
// auto-confirm (fund + settle); flagged runs are left for the admin queue. This
// is the "own the workflow" lever — retainers, not just one-off transfers.
import type { CreateScheduleInput, Cadence, Verdict } from '@gigbridge/shared';
import { CADENCE_DAYS } from '@gigbridge/shared';
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';
import { emitToUser } from '../../lib/ws.js';
import { createQuote } from '../fx/fx.service.js';
import { createPayment, confirmPayment } from '../payments/payment.service.js';

const DAY_MS = 86_400_000;

function advance(from: Date, cadence: Cadence): Date {
  return new Date(from.getTime() + CADENCE_DAYS[cadence] * DAY_MS);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(s: any) {
  return {
    id: s.id,
    companyId: s.companyId,
    payeeId: s.freelancerId,
    payeeName: s.freelancer?.name as string | undefined,
    srcCurrency: s.srcCurrency,
    dstCurrency: s.dstCurrency,
    srcAmountMinor: s.srcAmountMinor,
    purposeCode: s.purposeCode,
    cadence: s.cadence,
    active: s.active,
    nextRunAt: s.nextRunAt.toISOString(),
    lastRunAt: s.lastRunAt ? s.lastRunAt.toISOString() : null,
    runCount: s.runCount,
    createdAt: s.createdAt.toISOString(),
  };
}

export async function createSchedule(companyId: string, input: CreateScheduleInput) {
  const payee = await prisma.user.findUniqueOrThrow({ where: { id: input.payeeId } });
  if (payee.role !== 'FREELANCER') throw Object.assign(new Error('Payee must be a freelancer'), { statusCode: 400 });
  // First run: startAt if given, else immediately (fires on the next runner tick).
  const nextRunAt = input.startAt ? new Date(input.startAt) : new Date();
  const s = await prisma.payoutSchedule.create({
    data: {
      companyId,
      freelancerId: input.payeeId,
      srcCurrency: input.srcCurrency,
      dstCurrency: input.dstCurrency,
      srcAmountMinor: input.srcAmountMinor,
      purposeCode: input.purposeCode,
      cadence: input.cadence,
      nextRunAt,
    },
    include: { freelancer: true },
  });
  await audit(companyId, 'SCHEDULE_CREATED', `schedule:${s.id}`, null, { payeeId: input.payeeId, cadence: input.cadence });
  return serialize(s);
}

export async function setScheduleActive(scheduleId: string, companyId: string, active: boolean) {
  const s = await prisma.payoutSchedule.findUniqueOrThrow({ where: { id: scheduleId } });
  if (s.companyId !== companyId) throw Object.assign(new Error('Not your schedule'), { statusCode: 403 });
  const updated = await prisma.payoutSchedule.update({ where: { id: scheduleId }, data: { active }, include: { freelancer: true } });
  await audit(companyId, active ? 'SCHEDULE_RESUMED' : 'SCHEDULE_PAUSED', `schedule:${scheduleId}`, { active: s.active }, { active });
  return serialize(updated);
}

export async function listSchedules(companyId: string) {
  const rows = await prisma.payoutSchedule.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, include: { freelancer: true } });
  return rows.map(serialize);
}

// Fire one schedule once: create a payment via the orchestrator, auto-confirm if
// approved, advance nextRunAt. Returns the created payment id + verdict.
async function fireOnce(scheduleId: string): Promise<{ paymentId: string; verdict: Verdict | 'ERROR' }> {
  const s = await prisma.payoutSchedule.findUniqueOrThrow({ where: { id: scheduleId } });
  const result = await createPayment(s.companyId, {
    payeeId: s.freelancerId,
    srcCurrency: s.srcCurrency as CreateScheduleInput['srcCurrency'],
    dstCurrency: s.dstCurrency as CreateScheduleInput['dstCurrency'],
    srcAmountMinor: s.srcAmountMinor,
    purposeCode: s.purposeCode as CreateScheduleInput['purposeCode'],
  });
  await prisma.payment.update({ where: { id: result.payment.id }, data: { scheduleId } });

  const verdict = result.decision.verdict as Verdict;
  if (verdict === 'APPROVE') {
    // Fresh quote (the one from createPayment may be near expiry) then settle.
    const quote = await createQuote(`${s.srcCurrency}${s.dstCurrency}`, s.srcAmountMinor);
    await confirmPayment(result.payment.id, s.companyId, quote.quoteId);
  }

  await prisma.payoutSchedule.update({
    where: { id: scheduleId },
    data: { lastRunAt: new Date(), nextRunAt: advance(s.nextRunAt, s.cadence as Cadence), runCount: { increment: 1 } },
  });
  await notify(s.freelancerId, 'SCHEDULED_PAYOUT', `Recurring payout of ${s.srcCurrency} ${(s.srcAmountMinor / 100).toFixed(2)} initiated (${verdict}).`);
  return { paymentId: result.payment.id, verdict };
}

// Run every active schedule whose nextRunAt has passed. Optionally scoped to one
// company (manual trigger from that company's dashboard). Safe to call repeatedly.
export async function runDueSchedules(companyId?: string) {
  const due = await prisma.payoutSchedule.findMany({
    where: { active: true, nextRunAt: { lte: new Date() }, ...(companyId ? { companyId } : {}) },
  });
  const fired: { scheduleId: string; paymentId: string; verdict: string }[] = [];
  for (const s of due) {
    try {
      const r = await fireOnce(s.id);
      fired.push({ scheduleId: s.id, paymentId: r.paymentId, verdict: r.verdict });
    } catch (err) {
      // Never let one bad schedule wedge the runner; advance it so it doesn't spin.
      await prisma.payoutSchedule.update({
        where: { id: s.id },
        data: { lastRunAt: new Date(), nextRunAt: advance(s.nextRunAt, s.cadence as Cadence) },
      });
      fired.push({ scheduleId: s.id, paymentId: '', verdict: 'ERROR' });
    }
  }
  return { ran: fired.length, fired };
}

async function notify(userId: string, kind: string, message: string) {
  const n = await prisma.notification.create({ data: { userId, kind, message } });
  emitToUser(userId, {
    type: 'notification.new',
    notification: { id: n.id, userId, kind, message, read: false, createdAt: n.createdAt.toISOString() },
  });
}
