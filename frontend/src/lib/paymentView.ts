import type { Payment } from '@gigbridge/shared';
import { personName } from './directory';

export function corridorLabel(p: Pick<Payment, 'srcCurrency' | 'dstCurrency'>): string {
  return `${p.srcCurrency} to ${p.dstCurrency}`;
}

export function payeeName(p: Pick<Payment, 'freelancerId'>): string {
  return personName(p.freelancerId);
}

export function payerName(p: Pick<Payment, 'companyId'>): string {
  return personName(p.companyId);
}

/** Settlement duration in seconds from first to last committed timeline step. */
export function settlementSeconds(p: Payment): number | null {
  const times = (p.timeline.map((t) => t.at).filter(Boolean) as string[]).map((t) => new Date(t).getTime());
  let secs = times.length >= 2 ? (Math.max(...times) - Math.min(...times)) / 1000 : 0;
  if (secs <= 0) secs = (new Date(p.updatedAt).getTime() - new Date(p.createdAt).getTime()) / 1000;
  return secs > 0 ? secs : null;
}

export const IS_TERMINAL = (s: Payment['state']) =>
  s === 'COMPLETED' || s === 'REJECTED' || s === 'REFUNDED' || s === 'EXPIRED';
