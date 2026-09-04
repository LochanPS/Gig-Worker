// FX service: quoting, rate-locking, and history. Rates come from the live/fallback
// source in rates.ts. Quote/lock shape frozen (BUILD_CONTRACTS §4).
import { randomUUID } from 'node:crypto';
import type { FxQuote, Currency } from '@gigbridge/shared';
import { FEE, INCUMBENT_FEE_PCT, RATE_LOCK_MINUTES } from '@gigbridge/shared';
import { crossRate, getRates } from './rates.js';

// Quotes are held in memory for their 10-minute validity window.
const quotes = new Map<string, FxQuote>();

function feeMinor(srcAmountMinor: number): number {
  return Math.max(Math.round((srcAmountMinor * FEE.BPS) / 10_000), FEE.MIN_USD_MINOR);
}

function splitPair(pair: string): [Currency, Currency] {
  return [pair.slice(0, 3) as Currency, pair.slice(3, 6) as Currency];
}

export async function createQuote(pair: string, srcAmountMinor: number): Promise<FxQuote> {
  const [src, dst] = splitPair(pair);
  const { rate } = await crossRate(src, dst);
  const fee = feeMinor(srcAmountMinor);
  const gasEstimateMinor = 40;
  const payeeReceivesMinor = Math.round((srcAmountMinor - fee - gasEstimateMinor) * rate);
  const quote: FxQuote = {
    quoteId: randomUUID(),
    pair,
    midRate: rate,
    srcAmountMinor,
    feeMinor: fee,
    gasEstimateMinor,
    payeeReceivesMinor,
    incumbentFeeMinor: Math.round(srcAmountMinor * INCUMBENT_FEE_PCT),
    expiresAt: new Date(Date.now() + RATE_LOCK_MINUTES * 60_000).toISOString(),
  };
  quotes.set(quote.quoteId, quote);
  return quote;
}

export function getQuote(quoteId: string): FxQuote | undefined {
  return quotes.get(quoteId);
}

export function isQuoteValid(q: FxQuote): boolean {
  return new Date(q.expiresAt).getTime() > Date.now();
}

// Synthetic-but-plausible daily history for the corridor charts. Anchored to the
// current live/fallback rate so the last point matches today's quote.
export async function rateHistory(pair: string, days: number): Promise<{ date: string; rate: number }[]> {
  const [src, dst] = splitPair(pair);
  const { rate } = await crossRate(src, dst);
  const out: { date: string; rate: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const drift = Math.sin(i / 3.2) * rate * 0.01 + (Math.random() - 0.5) * rate * 0.003;
    out.push({
      date: new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
      rate: +(rate + drift).toFixed(4),
    });
  }
  return out;
}

export async function rateSource(): Promise<string> {
  return (await getRates()).source;
}
