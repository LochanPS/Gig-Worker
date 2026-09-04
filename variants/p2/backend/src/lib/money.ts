// Money helpers. Everything is integer minor units (cents / paise).
import type { Currency, Corridor, MinorUnits } from "@gigbridge/shared";
import { config } from "./config.js";

// All fiat currencies in the demo use 2 minor digits.
export const MINOR_DIGITS = 2;

export function corridorOf(src: Currency, dst: Currency): Corridor {
  return `${src}${dst}` as Corridor;
}

export function splitCorridor(pair: Corridor): { src: Currency; dst: Currency } {
  return { src: pair.slice(0, 3) as Currency, dst: pair.slice(3) as Currency };
}

/**
 * Fee on the source amount: FEE_BPS basis points, floored at FEE_MIN_USD
 * equivalent. `usdPerSrcUnit` converts the min-fee floor into source currency.
 */
export function computeFeeMinor(
  srcAmountMinor: MinorUnits,
  usdToSrcRate: number,
): MinorUnits {
  const bpsFee = Math.round((srcAmountMinor * config.fee.bps) / 10_000);
  const minFeeInSrc = Math.round(config.fee.minUsdMinor * usdToSrcRate);
  return Math.max(bpsFee, minFeeInSrc);
}

/** Convert a source minor amount to destination minor units at `midRate`. */
export function convertMinor(srcAmountMinor: MinorUnits, midRate: number): MinorUnits {
  return Math.round(srcAmountMinor * midRate);
}

export function formatMinor(amountMinor: MinorUnits): string {
  return (amountMinor / 10 ** MINOR_DIGITS).toFixed(MINOR_DIGITS);
}
