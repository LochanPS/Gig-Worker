import type {
  Currency,
  Jurisdiction,
  PurposeCode,
  RuleDirection,
  RuleResult,
  RuleSeverity,
} from "@gigbridge/shared";
import { isSanctioned } from "./watchlist.js";

// Thresholds are FROZEN (BUILD_CONTRACTS.txt section 8). Change only with a note
// in docs/INTEGRATION_LOG.txt.
export const THRESHOLDS = {
  IN_PAN_INR_MINOR: 50_000_00, // INR 50,000 in paise
  EU_EDD_EUR_MINOR: 10_000_00, // EUR 10,000 in cents
  IN_LRS_USD_MINOR: 250_000_00, // USD 250,000 in cents (annual per entity)
  VELOCITY_COUNT_24H: 5, // > 5 payments same payer->payee in 24h
  STRUCTURING_MIN_COUNT_72H: 3, // >= 3 payments...
  STRUCTURING_BAND: 0.1, // ...each within 10% below EU threshold, in 72h
  OUTLIER_MULTIPLE: 5, // > 5x payee trailing 90-day average
} as const;

// Everything the rules need about the candidate payment + its history.
export interface RuleContext {
  payerName: string;
  payeeName: string;
  payerCountry: string; // ISO-2
  payeeCountry: string;
  srcCurrency: Currency;
  dstCurrency: Currency;
  srcAmountMinor: number;
  purposeCode: PurposeCode | string;
  freelancerHasPan: boolean;

  // Amount expressed in several currencies' minor units for threshold checks.
  usdAmountMinor: number;
  eurAmountMinor: number;
  inrAmountMinor: number;

  // Historical aggregates (computed by the engine from prior payments).
  samePairCount24h: number;
  structuringCount72h: number;
  payeeTrailingAvgUsdMinor: number;
  payerLrsUsedUsdMinor: number; // outward-from-India annual total, excl. this
}

interface RuleDef {
  id: string;
  jurisdiction: Jurisdiction;
  direction: RuleDirection;
  severity: RuleSeverity;
  legalRef: string;
  // returns [triggered, message]
  evaluate: (ctx: RuleContext) => { triggered: boolean; message: string };
}

const inr = (m: number) => `INR ${(m / 100).toLocaleString("en-IN")}`;
const eur = (m: number) => `EUR ${(m / 100).toLocaleString("en-US")}`;
const usd = (m: number) => `USD ${(m / 100).toLocaleString("en-US")}`;

function isInbound(ctx: RuleContext): boolean {
  return ctx.payeeCountry === "IN";
}
function isOutboundFromIndia(ctx: RuleContext): boolean {
  return ctx.payerCountry === "IN";
}

export const RULES: RuleDef[] = [
  {
    id: "IN-RBI-001",
    jurisdiction: "IN",
    direction: "IN",
    severity: "BLOCK",
    legalRef: "FEMA — purpose code mandatory for inward remittance",
    evaluate: (ctx) => {
      if (!isInbound(ctx)) return { triggered: false, message: "Not an inward-to-India remittance." };
      const ok = typeof ctx.purposeCode === "string" && ctx.purposeCode.length > 0;
      return ok
        ? { triggered: false, message: `Purpose code ${ctx.purposeCode} present.` }
        : { triggered: true, message: "Inward remittance is missing a FEMA purpose code." };
    },
  },
  {
    id: "IN-RBI-002",
    jurisdiction: "IN",
    direction: "IN",
    severity: "BLOCK",
    legalRef: "RBI — PAN required for freelancer receipts above threshold",
    evaluate: (ctx) => {
      if (!isInbound(ctx)) return { triggered: false, message: "Not an inward-to-India remittance." };
      if (ctx.inrAmountMinor <= THRESHOLDS.IN_PAN_INR_MINOR)
        return { triggered: false, message: `Below ${inr(THRESHOLDS.IN_PAN_INR_MINOR)} PAN threshold.` };
      return ctx.freelancerHasPan
        ? { triggered: false, message: "Payee PAN on file." }
        : {
            triggered: true,
            message: `Payment of ${inr(ctx.inrAmountMinor)} exceeds ${inr(
              THRESHOLDS.IN_PAN_INR_MINOR,
            )}; payee PAN is required and not on file.`,
          };
    },
  },
  {
    id: "IN-RBI-003",
    jurisdiction: "IN",
    direction: "IN",
    severity: "INFO",
    legalRef: "RBI — export-of-services classification",
    evaluate: (ctx) => ({
      triggered: ctx.purposeCode === "P0802",
      message:
        ctx.purposeCode === "P0802"
          ? "Classified as export of software services (P0802)."
          : `Purpose ${ctx.purposeCode}: standard services classification.`,
    }),
  },
  {
    id: "IN-LRS-001",
    jurisdiction: "IN",
    direction: "OUT",
    severity: "FLAG",
    legalRef: "RBI LRS — USD 250,000 annual cap per resident entity",
    evaluate: (ctx) => {
      if (!isOutboundFromIndia(ctx))
        return { triggered: false, message: "Not an outward-from-India payment." };
      const projected = ctx.payerLrsUsedUsdMinor + ctx.usdAmountMinor;
      return projected > THRESHOLDS.IN_LRS_USD_MINOR
        ? {
            triggered: true,
            message: `Projected annual outward ${usd(projected)} exceeds LRS cap ${usd(
              THRESHOLDS.IN_LRS_USD_MINOR,
            )}.`,
          }
        : { triggered: false, message: `Within LRS cap (${usd(projected)} of ${usd(THRESHOLDS.IN_LRS_USD_MINOR)}).` };
    },
  },
  {
    id: "EU-AML-001",
    jurisdiction: "EU",
    direction: "ANY",
    severity: "FLAG",
    legalRef: "EU AMLD — enhanced due diligence above EUR 10,000",
    evaluate: (ctx) => {
      const involvesEu = ctx.srcCurrency === "EUR" || ctx.payerCountry === "DE";
      if (!involvesEu) return { triggered: false, message: "No EU leg." };
      return ctx.eurAmountMinor > THRESHOLDS.EU_EDD_EUR_MINOR
        ? {
            triggered: true,
            message: `Single payment ${eur(ctx.eurAmountMinor)} exceeds ${eur(
              THRESHOLDS.EU_EDD_EUR_MINOR,
            )}; enhanced due diligence required.`,
          }
        : { triggered: false, message: `Below EDD threshold ${eur(THRESHOLDS.EU_EDD_EUR_MINOR)}.` };
    },
  },
  {
    id: "EU-GDPR-001",
    jurisdiction: "EU",
    direction: "ANY",
    severity: "INFO",
    legalRef: "GDPR — no PII in on-chain payload",
    evaluate: () => ({
      triggered: false,
      message: "On-chain payload carries only a compliance hash; no PII present.",
    }),
  },
  {
    id: "US-OFAC-001",
    jurisdiction: "US",
    direction: "ANY",
    severity: "BLOCK",
    legalRef: "OFAC — SDN sanctions screen on both parties",
    evaluate: (ctx) => {
      const hit =
        (isSanctioned(ctx.payerName) && ctx.payerName) ||
        (isSanctioned(ctx.payeeName) && ctx.payeeName);
      return hit
        ? { triggered: true, message: `Sanctions match: "${hit}" appears on the mock SDN list.` }
        : { triggered: false, message: "Neither party matches the SDN list." };
    },
  },
  {
    id: "GB-VEL-001",
    jurisdiction: "GB",
    direction: "ANY",
    severity: "FLAG",
    legalRef: "Velocity monitoring",
    evaluate: (ctx) =>
      ctx.samePairCount24h > THRESHOLDS.VELOCITY_COUNT_24H
        ? {
            triggered: true,
            message: `${ctx.samePairCount24h} payments on this payer→payee pair in 24h (> ${THRESHOLDS.VELOCITY_COUNT_24H}).`,
          }
        : { triggered: false, message: `${ctx.samePairCount24h} payments in 24h; within velocity limit.` },
  },
  {
    id: "GB-STR-001",
    jurisdiction: "GB",
    direction: "ANY",
    severity: "FLAG",
    legalRef: "Structuring / smurfing detection",
    evaluate: (ctx) =>
      ctx.structuringCount72h >= THRESHOLDS.STRUCTURING_MIN_COUNT_72H
        ? {
            triggered: true,
            message: `${ctx.structuringCount72h} payments within 10% below the EUR 10,000 threshold in 72h — possible structuring.`,
          }
        : { triggered: false, message: "No structuring pattern detected." },
  },
  {
    id: "GB-OUT-001",
    jurisdiction: "GB",
    direction: "ANY",
    severity: "FLAG",
    legalRef: "Statistical outlier detection",
    evaluate: (ctx) => {
      const avg = ctx.payeeTrailingAvgUsdMinor;
      if (avg <= 0) return { triggered: false, message: "No trailing history for payee yet." };
      return ctx.usdAmountMinor > avg * THRESHOLDS.OUTLIER_MULTIPLE
        ? {
            triggered: true,
            message: `${usd(ctx.usdAmountMinor)} is more than ${THRESHOLDS.OUTLIER_MULTIPLE}x the payee's 90-day average (${usd(avg)}).`,
          }
        : { triggered: false, message: `Within ${THRESHOLDS.OUTLIER_MULTIPLE}x payee trailing average.` };
    },
  },
];

export function evaluateRules(ctx: RuleContext): RuleResult[] {
  return RULES.map((r) => {
    const { triggered, message } = r.evaluate(ctx);
    return {
      id: r.id,
      jurisdiction: r.jurisdiction,
      direction: r.direction,
      severity: r.severity,
      triggered,
      passed: !triggered,
      legalRef: r.legalRef,
      message,
    };
  });
}

export function ruleRegistry() {
  return RULES.map(({ id, jurisdiction, direction, severity, legalRef }) => ({
    id,
    jurisdiction,
    direction,
    severity,
    legalRef,
  }));
}
