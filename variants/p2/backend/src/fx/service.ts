import { config } from "../lib/config.js";
import { prisma } from "../lib/db.js";
import {
  computeFeeMinor,
  convertMinor,
  splitCorridor,
} from "../lib/money.js";
import type { Corridor, Currency, FxQuoteDTO, MinorUnits } from "@gigbridge/shared";
import fallback from "./fallback.json" with { type: "json" };

// Fixed gas estimate shown in quotes (source minor units). Settlement on anvil
// is effectively free; this is the demo's transparent "network fee" line.
const GAS_ESTIMATE_MINOR = 5;

/** USD value of one unit of `cur`, from the offline snapshot. */
function usdPer(cur: Currency): number {
  return (fallback.usdPer as Record<string, number>)[cur] ?? 1;
}

/** How many `cur` minor units equal one USD minor unit (for the min-fee floor). */
function usdToCurRate(cur: Currency): number {
  return 1 / usdPer(cur);
}

/**
 * Mid-market rate for a corridor. Live from frankfurter.app unless FX_OFFLINE,
 * with the offline snapshot as a hard fallback on any network error so the demo
 * never has a hard network dependency.
 */
export async function getMidRate(pair: Corridor): Promise<{ rate: number; source: string }> {
  const { src, dst } = splitCorridor(pair);
  if (config.fx.offline) {
    return { rate: offlineRate(pair), source: "offline-snapshot" };
  }
  try {
    const url = `${config.fx.apiUrl}/latest?from=${src}&to=${dst}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) throw new Error(`fx api ${res.status}`);
    const data = (await res.json()) as { rates?: Record<string, number> };
    const rate = data.rates?.[dst];
    if (!rate || !Number.isFinite(rate)) throw new Error("fx api: missing rate");
    return { rate, source: "frankfurter.app" };
  } catch {
    return { rate: offlineRate(pair), source: "offline-fallback" };
  }
}

function offlineRate(pair: Corridor): number {
  const direct = (fallback.rates as Record<string, number>)[pair];
  if (direct) return direct;
  // Derive from USD anchors if the pair is not directly listed.
  const { src, dst } = splitCorridor(pair);
  return usdPer(src) / usdPer(dst);
}

/**
 * Produce a quote: mid rate, fee (75bps min $1), gas, payee-receives, and a
 * 10-minute lock persisted to FxRate. quoteId == FxRate.id.
 */
export async function createQuote(pair: Corridor, srcAmountMinor: MinorUnits): Promise<FxQuoteDTO> {
  const { src } = splitCorridor(pair);
  const { rate, source } = await getMidRate(pair);

  const fee = computeFeeMinor(srcAmountMinor, usdToCurRate(src));
  const netSrc = Math.max(0, srcAmountMinor - fee - GAS_ESTIMATE_MINOR);
  const payeeReceives = convertMinor(netSrc, rate);

  const lockedUntil = new Date(Date.now() + config.rateLockMinutes * 60_000);
  const fx = await prisma.fxRate.create({
    data: {
      pair,
      midRate: rate,
      lockedRate: rate,
      lockedUntil,
      source,
    },
  });

  return {
    quoteId: fx.id,
    pair,
    midRate: rate,
    srcAmountMinor,
    fee,
    gasEstimate: GAS_ESTIMATE_MINOR,
    payeeReceives,
    expiresAt: lockedUntil.toISOString(),
  };
}

/** Validate a locked quote at confirm time; throws if expired/unknown. */
export async function consumeLockedQuote(quoteId: string) {
  const fx = await prisma.fxRate.findUnique({ where: { id: quoteId } });
  if (!fx || !fx.lockedRate || !fx.lockedUntil) return null;
  if (fx.lockedUntil.getTime() < Date.now()) return { expired: true, fx } as const;
  return { expired: false, fx } as const;
}

/** Synthetic-but-stable FX history for charts (offline-safe). */
export async function getHistory(pair: Corridor, days: number) {
  const { rate } = await getMidRate(pair);
  const out: Array<{ date: string; rate: number }> = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    // Gentle deterministic wave around the current mid so charts look alive.
    const wave = Math.sin(i / 4) * 0.01 + Math.cos(i / 11) * 0.006;
    out.push({ date: d.toISOString().slice(0, 10), rate: +(rate * (1 + wave)).toFixed(6) });
  }
  return out;
}

export const _fxTestHooks = { usdPer, usdToCurRate, offlineRate, GAS_ESTIMATE_MINOR };
export type { Corridor };
