/**
 * GigBridge shared enums — single source of truth for all string-literal
 * unions used across backend, frontend, and contracts glue.
 *
 * Pattern: define a readonly array + derive the union type. The same array
 * feeds `z.enum(...)` in schemas.ts, so there is exactly one place to change.
 */

// ---- Users & identity -------------------------------------------------------

export const ROLES = ["COMPANY", "FREELANCER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

/** KYC (freelancer) and KYB (company) share the same verification lifecycle. */
export const VERIFICATION_STATUSES = ["PENDING", "VERIFIED", "REJECTED"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const PAYOUT_PREFERENCES = ["AUTO_CONVERT", "HOLD"] as const;
export type PayoutPreference = (typeof PAYOUT_PREFERENCES)[number];

// ---- Money ------------------------------------------------------------------

/** Demo corridors only: EUR<->INR and USD<->INR (PRD 4.3 non-goals). */
export const CURRENCIES = ["EUR", "USD", "INR"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** FX pairs we quote. Format is <SRC><DST>. */
export const FX_PAIRS = ["EURINR", "USDINR", "INRUSD", "INREUR"] as const;
export type FxPair = (typeof FX_PAIRS)[number];

// ---- Payment lifecycle (TRD 4.2) -------------------------------------------

/**
 * DRAFT -> COMPLIANCE_CHECK -> (REJECTED | FLAGGED -> [admin] -> APPROVED)
 *       -> RATE_LOCKED -> FUNDED -> SETTLING -> COMPLETED
 * side paths: REFUNDED (from FUNDED), EXPIRED (rate-lock timeout).
 */
export const PAYMENT_STATES = [
  "DRAFT",
  "COMPLIANCE_CHECK",
  "FLAGGED",
  "REJECTED",
  "APPROVED",
  "RATE_LOCKED",
  "FUNDED",
  "SETTLING",
  "COMPLETED",
  "REFUNDED",
  "EXPIRED",
] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

/** Terminal states — no further transitions allowed. */
export const TERMINAL_PAYMENT_STATES = [
  "COMPLETED",
  "REJECTED",
  "REFUNDED",
  "EXPIRED",
] as const satisfies readonly PaymentState[];

// ---- Compliance -------------------------------------------------------------

export const VERDICTS = ["APPROVE", "FLAG", "REJECT"] as const;
export type Verdict = (typeof VERDICTS)[number];

/** Per-rule severity. BLOCK => REJECT, FLAG => FLAG, INFO => note only. */
export const RULE_SEVERITIES = ["BLOCK", "FLAG", "INFO"] as const;
export type RuleSeverity = (typeof RULE_SEVERITIES)[number];

export const JURISDICTIONS = ["IN", "EU", "US", "GLOBAL"] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

/** Remittance direction relative to a jurisdiction. */
export const DIRECTIONS = ["IN", "OUT"] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** RBI/FEMA purpose codes (representative subset, TRD 4.5). */
export const PURPOSE_CODES = ["P0802", "P0803", "P1006", "P1099"] as const;
export type PurposeCode = (typeof PURPOSE_CODES)[number];

// ---- Fraud / anomaly alerts -------------------------------------------------

export const ALERT_TYPES = ["VELOCITY", "STRUCTURING", "OUTLIER", "SANCTIONS"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

// ---- On-chain escrow state (EscrowVault.sol, TRD 3.3) -----------------------

export const ESCROW_STATES = ["None", "Funded", "Released", "Refunded", "Frozen"] as const;
export type EscrowState = (typeof ESCROW_STATES)[number];

// ---- Invoices ---------------------------------------------------------------

export const INVOICE_STATES = ["OPEN", "APPROVED", "PAID", "CANCELLED"] as const;
export type InvoiceState = (typeof INVOICE_STATES)[number];
