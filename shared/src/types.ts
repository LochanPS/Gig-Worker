// Canonical enums and entity types — source of truth for FE + BE.
// Mirrors BUILD_CONTRACTS.txt section 3. Any change here requires a note in
// docs/INTEGRATION_LOG.txt in the same commit.

export const PAYMENT_STATES = [
  "DRAFT",
  "COMPLIANCE_CHECK",
  "FLAGGED",
  "REJECTED",
  "RATE_LOCKED",
  "FUNDED",
  "SETTLING",
  "COMPLETED",
  "REFUNDED",
  "EXPIRED",
] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export const VERDICTS = ["APPROVE", "FLAG", "REJECT"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const ROLES = ["COMPANY", "FREELANCER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const KYC_STATUSES = ["PENDING", "VERIFIED", "REJECTED"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const ALERT_TYPES = ["VELOCITY", "STRUCTURING", "OUTLIER", "SANCTIONS"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const CURRENCIES = ["EUR", "USD", "INR"] as const;
export type Currency = (typeof CURRENCIES)[number];

// Corridor pairs used in the demo.
export const CORRIDORS = ["EURINR", "USDINR", "INRUSD"] as const;
export type Corridor = (typeof CORRIDORS)[number];

export const PURPOSE_CODES = ["P0802", "P0801", "P1006", "P0805"] as const;
export type PurposeCode = (typeof PURPOSE_CODES)[number];

export const PURPOSE_CODE_LABELS: Record<PurposeCode, string> = {
  P0802: "Software services",
  P0801: "IT / consultancy services",
  P1006: "Design services",
  P0805: "Data processing services",
};

export const PAYOUT_PREFERENCES = ["AUTO_CONVERT", "HOLD"] as const;
export type PayoutPreference = (typeof PAYOUT_PREFERENCES)[number];

export const KYB_STATUSES = ["PENDING", "VERIFIED", "REJECTED"] as const;
export type KybStatus = (typeof KYB_STATUSES)[number];

// Compliance rule severities (TRD 4.5).
export const RULE_SEVERITIES = ["BLOCK", "FLAG", "INFO"] as const;
export type RuleSeverity = (typeof RULE_SEVERITIES)[number];

export type Jurisdiction = "IN" | "EU" | "US" | "GB";
export type RuleDirection = "IN" | "OUT" | "ANY";

// ---- Money ----
// Amounts are integers in MINOR units (cents / paise) everywhere in API + DB.
export type MinorUnits = number;

// ---- DTOs returned by the API ----

export interface UserDTO {
  id: string;
  role: Role;
  email: string;
  country: string;
  name: string;
  walletAddress: string | null;
  createdAt: string;
}

export interface CredentialDTO {
  id: string;
  did: string;
  hash: string;
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
}

export interface RuleResult {
  id: string;
  jurisdiction: Jurisdiction;
  direction: RuleDirection;
  severity: RuleSeverity;
  passed: boolean;
  triggered: boolean;
  legalRef: string;
  message: string;
}

export interface ComplianceDecisionDTO {
  id: string;
  verdict: Verdict;
  ruleResults: RuleResult[];
  agentExplanation: string;
  anchorTxHash: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface TimelineEntry {
  state: PaymentState;
  at: string;
  note?: string;
  txHash?: string;
}

export interface FxQuoteDTO {
  quoteId: string;
  pair: Corridor;
  midRate: number;
  srcAmountMinor: MinorUnits;
  fee: MinorUnits; // in source currency minor units
  gasEstimate: MinorUnits;
  payeeReceives: MinorUnits; // in destination currency minor units
  expiresAt: string;
}

export interface PaymentDTO {
  id: string;
  companyId: string;
  freelancerId: string;
  payerName: string;
  payeeName: string;
  srcCurrency: Currency;
  dstCurrency: Currency;
  srcAmountMinor: MinorUnits;
  dstAmountMinor: MinorUnits | null;
  feeAmountMinor: MinorUnits | null;
  purposeCode: PurposeCode;
  invoiceRef: string | null;
  state: PaymentState;
  escrowId: string | null;
  txHashFund: string | null;
  txHashRelease: string | null;
  timeline: TimelineEntry[];
  compliance: ComplianceDecisionDTO | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertDTO {
  id: string;
  type: AlertType;
  paymentId: string | null;
  severity: RuleSeverity;
  details: Record<string, unknown>;
  resolved: boolean;
  createdAt: string;
}

export interface NotificationDTO {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface AdminMetricsDTO {
  totalVolumeUsdMinor: MinorUnits;
  feeRevenueUsdMinor: MinorUnits;
  paymentsCompleted: number;
  paymentsFlagged: number;
  avgSettlementSeconds: number;
  byCorridor: Array<{ pair: Corridor; count: number; volumeUsdMinor: MinorUnits }>;
}

export interface ApiError {
  error: { code: string; message: string };
}
