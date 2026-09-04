// Canonical enums — single source of truth (see docs/BUILD_CONTRACTS.txt section 3).
// Any change here MUST be noted in INTEGRATION_LOG.txt in the same commit.

export const PAYMENT_STATES = [
  'DRAFT',
  'COMPLIANCE_CHECK',
  'FLAGGED',
  'REJECTED',
  'RATE_LOCKED',
  'FUNDED',
  'SETTLING',
  'COMPLETED',
  'REFUNDED',
  'EXPIRED',
  // Unhappy-path states (real money spends real time here). Additive — the happy
  // path DRAFT..COMPLETED is unchanged.
  'PAYOUT_FAILED', // no valid payout destination for the payee (bank account missing)
  'DISPUTED', // a party opened a dispute; funds held pending admin resolution
  'REVERSED', // dispute resolved in payer's favour — escrow refunded
] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

// Dispute lifecycle. A dispute puts its payment ON hold (DISPUTED) until an admin
// resolves it: REFUND reverses the payment, DISMISS restores it.
export const DISPUTE_STATUSES = ['OPEN', 'RESOLVED_REFUND', 'RESOLVED_DISMISS'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const VERDICTS = ['APPROVE', 'FLAG', 'REJECT'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const ROLES = ['COMPANY', 'FREELANCER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const KYC_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const ALERT_TYPES = ['VELOCITY', 'STRUCTURING', 'OUTLIER', 'SANCTIONS'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const CURRENCIES = ['EUR', 'USD', 'INR'] as const;
export type Currency = (typeof CURRENCIES)[number];

// Corridor pairs used in the demo.
export const CORRIDORS = ['EURINR', 'USDINR', 'INRUSD'] as const;
export type Corridor = (typeof CORRIDORS)[number];

// FEMA-style purpose codes offered in the payout wizard.
export const PURPOSE_CODES = ['P0802', 'P0801', 'P1006', 'P0805'] as const;
export type PurposeCode = (typeof PURPOSE_CODES)[number];

export const PURPOSE_CODE_LABELS: Record<PurposeCode, string> = {
  P0802: 'Software services',
  P0801: 'IT / business consultancy',
  P1006: 'Design services',
  P0805: 'Data processing services',
};

export const ALERT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

// Batch pay-run lifecycle (FR-2.5). One run fans out into N child payments; the
// run status summarises them: DRAFT while items are being compliance-checked,
// REVIEWED once every child has a verdict, CONFIRMED once approved children are
// released, COMPLETED when all releasable children settled (PARTIAL if some were
// rejected/flagged and skipped).
export const PAYRUN_STATUSES = ['DRAFT', 'REVIEWED', 'CONFIRMED', 'COMPLETED', 'PARTIAL'] as const;
export type PayRunStatus = (typeof PAYRUN_STATUSES)[number];

// Recurring payout cadence (retainers). nextRunAt advances by the cadence each run.
export const CADENCES = ['WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const;
export type Cadence = (typeof CADENCES)[number];

export const CADENCE_DAYS: Record<Cadence, number> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
};
