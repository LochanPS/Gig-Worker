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
] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

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
