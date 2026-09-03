// Rate source: live frankfurter.app (ECB) with an in-memory TTL cache and a
// committed offline snapshot fallback so the demo never hard-depends on network.
import { createRequire } from 'node:module';
import { env } from '../../lib/env.js';
import type { Currency } from '@gigbridge/shared';

const require = createRequire(import.meta.url);
const fallback = require('./fallback.json') as { base: string; rates: Record<string, number> };

const CACHE_TTL_MS = 60_000;
interface CacheEntry {
  rates: Record<string, number>;
  at: number;
  source: 'live' | 'fallback';
}
let cache: CacheEntry | null = null;

// Normalize any table to EUR-based so we can compute arbitrary cross rates.
function toEurBase(base: string, rates: Record<string, number>): Record<string, number> {
  if (base === 'EUR') return rates;
  const perEur = rates['EUR'];
  if (!perEur) return rates;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rates)) out[k] = v / perEur;
  return out;
}

async function fetchLive(): Promise<CacheEntry> {
  const url = `${env.FX_API_URL}/latest?from=EUR&to=USD,INR`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`FX ${res.status}`);
    const json = (await res.json()) as { base: string; rates: Record<string, number> };
    const rates = { EUR: 1, ...toEurBase(json.base, json.rates) };
    return { rates, at: Date.now(), source: 'live' };
  } finally {
    clearTimeout(timer);
  }
}

function fallbackEntry(): CacheEntry {
  return { rates: toEurBase(fallback.base, { EUR: 1, ...fallback.rates }), at: Date.now(), source: 'fallback' };
}

// Returns an EUR-based rate table, cached, degrading to the snapshot on any error.
export async function getRates(): Promise<CacheEntry> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache;
  if (env.FX_OFFLINE) {
    cache = fallbackEntry();
    return cache;
  }
  try {
    cache = await fetchLive();
  } catch {
    cache = fallbackEntry();
  }
  return cache;
}

// Cross rate: units of `quote` per 1 unit of `base`.
export async function crossRate(base: Currency, quote: Currency): Promise<{ rate: number; source: string }> {
  const { rates, source } = await getRates();
  const b = rates[base];
  const q = rates[quote];
  if (!b || !q) return { rate: 1, source };
  return { rate: q / b, source };
}
