// Every amount crossing the API is an integer in minor units (cents / paise).
// This module is the ONLY place a division by 100 is permitted.
import { INCUMBENT_FEE_PCT, type Currency } from '@gigbridge/shared';

const MINOR_PER_MAJOR = 100;

const SYMBOL: Record<string, string> = { EUR: 'EUR', USD: 'USD', INR: 'INR' };

export function toMajor(minor: number): number {
  return minor / MINOR_PER_MAJOR;
}

export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value) || value <= 0) return null;
  return Math.round(value * MINOR_PER_MAJOR);
}

export function formatMoney(
  minor: number | null | undefined,
  currency: Currency | string,
  opts: { code?: boolean; decimals?: number } = {},
): string {
  if (minor === null || minor === undefined) return '-';
  const { code = true, decimals = 2 } = opts;
  const value = toMajor(minor);
  const body = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return code ? `${body} ${SYMBOL[currency] ?? currency}` : body;
}

export function formatCompact(minor: number, currency: Currency | string): string {
  const value = toMajor(minor);
  const body =
    value >= 1_000_000
      ? `${(value / 1_000_000).toFixed(1)}M`
      : value >= 1_000
        ? `${(value / 1_000).toFixed(1)}k`
        : value.toFixed(0);
  return `${body} ${SYMBOL[currency] ?? currency}`;
}

/** What an 8-10 percent incumbent would have taken, in source minor units. */
export function incumbentFee(srcAmountMinor: number): number {
  return Math.round(srcAmountMinor * INCUMBENT_FEE_PCT);
}

/** Percentage of the gross the payee actually keeps, e.g. 99.25. */
export function retentionPct(srcAmountMinor: number, feeMinor: number, gasMinor = 0): number {
  if (srcAmountMinor <= 0) return 0;
  return ((srcAmountMinor - feeMinor - gasMinor) / srcAmountMinor) * 100;
}

export function savingsVsIncumbent(srcAmountMinor: number, feeMinor: number): number {
  return Math.max(incumbentFee(srcAmountMinor) - feeMinor, 0);
}

export function pairOf(src: string, dst: string): string {
  return `${src}${dst}`;
}
