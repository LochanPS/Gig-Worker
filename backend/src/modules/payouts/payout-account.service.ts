// Payout methods (the "add a bank account" flow the demo skipped). A freelancer
// must have an active account in the payment's destination currency for a payout
// to settle — otherwise the payment lands in PAYOUT_FAILED. accountNumber is
// stored masked (last 4). DEMO ONLY — a real integration tokenizes with the rail.
import type { AddPayoutAccountInput } from '@gigbridge/shared';
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';

const mask = (acct: string) => (acct.length <= 4 ? acct : '••••' + acct.slice(-4));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(a: any) {
  return {
    id: a.id,
    userId: a.userId,
    label: a.label,
    currency: a.currency,
    accountName: a.accountName,
    accountNumberMasked: a.accountNumberMasked,
    bankIdentifier: a.bankIdentifier,
    active: a.active,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function addPayoutAccount(userId: string, input: AddPayoutAccountInput) {
  const a = await prisma.payoutAccount.create({
    data: {
      userId,
      label: input.label,
      currency: input.currency,
      accountName: input.accountName,
      accountNumberMasked: mask(input.accountNumber),
      bankIdentifier: input.bankIdentifier,
    },
  });
  await audit(userId, 'PAYOUT_ACCOUNT_ADDED', `payoutAccount:${a.id}`, null, { currency: input.currency });
  return serialize(a);
}

export async function listPayoutAccounts(userId: string) {
  const rows = await prisma.payoutAccount.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  return rows.map(serialize);
}

export async function deactivatePayoutAccount(id: string, userId: string) {
  const a = await prisma.payoutAccount.findUniqueOrThrow({ where: { id } });
  if (a.userId !== userId) throw Object.assign(new Error('Not your account'), { statusCode: 403 });
  const updated = await prisma.payoutAccount.update({ where: { id }, data: { active: false } });
  await audit(userId, 'PAYOUT_ACCOUNT_REMOVED', `payoutAccount:${id}`, { active: true }, { active: false });
  return serialize(updated);
}

// Settlement gate: does the payee have somewhere to receive this currency?
export async function hasActivePayoutAccount(userId: string, currency: string): Promise<boolean> {
  const n = await prisma.payoutAccount.count({ where: { userId, currency, active: true } });
  return n > 0;
}
