import { describe, it, expect } from "vitest";
import { evaluateRules, THRESHOLDS, type RuleContext } from "./rules.js";
import { addToWatchlist } from "./watchlist.js";

// Baseline: clean EUR->INR software payment from Germany to a PAN-holding
// Indian freelancer, below all thresholds, no history.
function baseCtx(over: Partial<RuleContext> = {}): RuleContext {
  return {
    payerName: "Novatek GmbH",
    payeeName: "Priya Sharma",
    payerCountry: "DE",
    payeeCountry: "IN",
    srcCurrency: "EUR",
    dstCurrency: "INR",
    srcAmountMinor: 500_00,
    purposeCode: "P0802",
    freelancerHasPan: true,
    usdAmountMinor: 543_00,
    eurAmountMinor: 500_00,
    inrAmountMinor: 45_000_00,
    samePairCount24h: 1,
    structuringCount72h: 0,
    payeeTrailingAvgUsdMinor: 500_00,
    payerLrsUsedUsdMinor: 0,
    ...over,
  };
}

function triggered(ctx: RuleContext): string[] {
  return evaluateRules(ctx)
    .filter((r) => r.triggered)
    .map((r) => r.id);
}

describe("compliance rules", () => {
  it("clean baseline triggers only the informational P0802 note", () => {
    expect(triggered(baseCtx())).toEqual(["IN-RBI-003"]);
  });

  it("IN-RBI-001 blocks inward remittance missing a purpose code", () => {
    expect(triggered(baseCtx({ purposeCode: "" }))).toContain("IN-RBI-001");
  });

  it("IN-RBI-002 blocks > INR 50,000 without PAN", () => {
    const ctx = baseCtx({ inrAmountMinor: THRESHOLDS.IN_PAN_INR_MINOR + 1, freelancerHasPan: false });
    expect(triggered(ctx)).toContain("IN-RBI-002");
  });

  it("IN-RBI-002 passes > INR 50,000 with PAN on file", () => {
    const ctx = baseCtx({ inrAmountMinor: THRESHOLDS.IN_PAN_INR_MINOR + 1, freelancerHasPan: true });
    expect(triggered(ctx)).not.toContain("IN-RBI-002");
  });

  it("IN-LRS-001 flags outward-from-India above the annual cap", () => {
    const ctx = baseCtx({
      payerCountry: "IN",
      payeeCountry: "US",
      payerLrsUsedUsdMinor: THRESHOLDS.IN_LRS_USD_MINOR,
      usdAmountMinor: 1_00,
    });
    expect(triggered(ctx)).toContain("IN-LRS-001");
  });

  it("EU-AML-001 flags a single EUR payment over 10,000", () => {
    const ctx = baseCtx({ eurAmountMinor: THRESHOLDS.EU_EDD_EUR_MINOR + 1 });
    expect(triggered(ctx)).toContain("EU-AML-001");
  });

  it("US-OFAC-001 blocks a sanctioned party", () => {
    addToWatchlist("Red Harbor Trading");
    const ctx = baseCtx({ payeeName: "Red Harbor Trading" });
    expect(triggered(ctx)).toContain("US-OFAC-001");
  });

  it("GB-VEL-001 flags more than 5 payments on a pair in 24h", () => {
    expect(triggered(baseCtx({ samePairCount24h: 6 }))).toContain("GB-VEL-001");
    expect(triggered(baseCtx({ samePairCount24h: 5 }))).not.toContain("GB-VEL-001");
  });

  it("GB-STR-001 flags 3+ near-threshold payments in 72h", () => {
    expect(triggered(baseCtx({ structuringCount72h: 3 }))).toContain("GB-STR-001");
    expect(triggered(baseCtx({ structuringCount72h: 2 }))).not.toContain("GB-STR-001");
  });

  it("GB-OUT-001 flags amounts over 5x the payee trailing average", () => {
    const ctx = baseCtx({ payeeTrailingAvgUsdMinor: 100_00, usdAmountMinor: 600_00 });
    expect(triggered(ctx)).toContain("GB-OUT-001");
  });

  it("every rule id is represented in output", () => {
    const ids = evaluateRules(baseCtx()).map((r) => r.id);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
  });
});
