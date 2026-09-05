// The payee's off-ramp destination, described once for every surface that shows
// it: the customer list, the payout wizard's payee picker, and the documents.
//
// This is the "last mile" — after the on-chain release, where the fiat actually
// lands. It used to be visible only AFTER a payment completed, which meant a
// company committed to a payout without ever being told where the money would go.
import type { Currency, PayoutMethod } from '@gigbridge/shared';

export interface PayoutDestination {
  method: PayoutMethod;
  currency: Currency;
  masked: string;
}

// Mask a UPI VPA: keep the first character of the handle and the full PSP, star
// the rest (priya@okhdfcbank -> p****@okhdfcbank). Pure — tested.
export function maskVpa(vpa: string | null | undefined): string | null {
  if (!vpa) return null;
  const at = vpa.indexOf('@');
  if (at <= 0) return vpa;
  const handle = vpa.slice(0, at);
  const psp = vpa.slice(at + 1);
  return `${handle.slice(0, 1)}${'*'.repeat(Math.max(2, handle.length - 1))}@${psp}`;
}

// Describe the account the off-ramp would push to. Pure — tested.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function describeDestination(account: any | null | undefined): PayoutDestination | null {
  if (!account) return null;
  const method = (account.method ?? 'BANK') as PayoutMethod;
  return {
    method,
    currency: account.currency as Currency,
    masked: (method === 'UPI' ? maskVpa(account.vpa) : account.accountNumberMasked) ?? '—',
  };
}

// Pick the account a payout would actually use: the most recent ACTIVE one in the
// currency, matching creditPayee()'s own ordering so the UI never promises a
// destination the off-ramp would not choose. Pass no currency to take any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function activeDestination(accounts: any[] | undefined, currency?: string): PayoutDestination | null {
  const rows = (accounts ?? []).filter((a) => a.active !== false && (!currency || a.currency === currency));
  return describeDestination(rows[0] ?? null);
}
