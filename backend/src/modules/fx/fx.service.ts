// FX service — MINIMAL version for step 3 (orchestrator needs quoting).
// Step 4 replaces the rate source with frankfurter.app + offline fallback and
// adds /fx/history. The quote/lock shape here is frozen (BUILD_CONTRACTS §4).
import { randomUUID } from 'node:crypto';
import type { FxQuote } from '@gigbridge/shared';
import { FEE, INCUMBENT_FEE_PCT, RATE_LOCK_MINUTES } from '@gigbridge/shared';
import { env } from '../../lib/env.js';

// Placeholder static rates; step 4 makes these live.
const STATIC_RATES: Record<string, number> = { EURINR: 90.24, USDINR: 83.1, INRUSD: 0.01203 };

// In-memory quote store; a real store lands with the DB-backed FxRate in step 4.
const quotes = new Map<string, FxQuote>();

export function midRate(pair: string): number {
  return STATIC_RATES[pair] ?? 1;
}

function feeMinor(srcAmountMinor: number): number {
  return Math.max(Math.round((srcAmountMinor * FEE.BPS) / 10_000), FEE.MIN_USD_MINOR);
}

export function createQuote(pair: string, srcAmountMinor: number): FxQuote {
  const rate = midRate(pair);
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

export const fxOffline = env.FX_OFFLINE;
