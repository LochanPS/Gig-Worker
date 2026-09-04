// Entity shapes shared across backend and frontend.
// Amounts are ALWAYS integers in minor units (cents/paise). See BUILD_CONTRACTS §3.

import type {
  PaymentState,
  Verdict,
  Role,
  KycStatus,
  AlertType,
  AlertSeverity,
  Currency,
  PurposeCode,
  EscrowMode,
  PayRunStatus,
  Cadence,
  DisputeStatus,
} from './enums.js';

export interface User {
  id: string;
  role: Role;
  email: string;
  country: string; // ISO-3166 alpha-2, e.g. 'DE', 'IN', 'US'
  name: string;
  walletAddress: string | null;
  createdAt: string; // ISO timestamp
}

export interface CompanyProfile {
  userId: string;
  legalName: string;
  regNumber: string;
  country: string;
  kybStatus: KycStatus;
}

export interface FreelancerProfile {
  userId: string;
  fullName: string;
  country: string;
  panOrTaxId: string | null;
  kycStatus: KycStatus;
  payoutPreference: 'AUTO_CONVERT' | 'HOLD';
}

export interface Credential {
  id: string;
  userId: string;
  did: string;
  hash: string; // keccak256 of the off-chain credential JSON; mirrored on-chain
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
  anchorTxHash: string | null;
}

export interface TimelineStep {
  key: string; // e.g. 'CREATED', 'COMPLIANCE_APPROVED', 'RATE_LOCKED', ...
  label: string;
  state: PaymentState | null;
  at: string | null; // null = not reached yet
  actor: string | null;
  detail?: Record<string, unknown>;
  txHash?: string | null;
}

export interface Payment {
  id: string;
  companyId: string;
  freelancerId: string;
  srcCurrency: Currency;
  dstCurrency: Currency;
  srcAmountMinor: number;
  dstAmountMinor: number | null;
  feeAmountMinor: number | null;
  fxRateId: string | null;
  purposeCode: PurposeCode | null;
  invoiceRef: string | null;
  state: PaymentState;
  escrowId: string | null; // keccak256(uuid), the on-chain id
  escrowMode: EscrowMode; // INSTANT settles through; HOLD waits for work approval
  complianceDecisionId: string | null;
  txHashFund: string | null;
  txHashRelease: string | null;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineStep[];
}

export interface RuleResult {
  ruleId: string; // e.g. 'IN-RBI-001'
  jurisdiction: 'INDIA' | 'EU' | 'US' | 'PLATFORM';
  passed: boolean;
  severity: 'BLOCK' | 'FLAG' | 'INFO';
  legalRef: string;
  message: string;
}

export interface ComplianceDecision {
  id: string;
  paymentId: string;
  verdict: Verdict;
  ruleResults: RuleResult[];
  agentExplanation: string;
  anchorTxHash: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  paymentId: string | null;
  details: Record<string, unknown>;
  resolved: boolean;
  createdAt: string;
}

export interface FxQuote {
  quoteId: string;
  pair: string;
  midRate: number; // units of dst per 1 unit of src
  srcAmountMinor: number;
  feeMinor: number; // in src currency minor units
  gasEstimateMinor: number; // in src currency minor units
  payeeReceivesMinor: number; // in dst currency minor units
  incumbentFeeMinor: number; // "vs PayPal" comparison, src minor units
  expiresAt: string;
}

export interface Invoice {
  id: string;
  freelancerId: string;
  companyId: string;
  amountMinor: number;
  currency: Currency;
  memo: string;
  status: 'SENT' | 'APPROVED' | 'PAID';
  paymentId: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  kind: string;
  message: string;
  read: boolean;
  createdAt: string;
}

// Batch pay-run (FR-2.5). A run owns N child payments; the summary carries the
// aggregate the dashboard renders without loading every child.
export interface PayRun {
  id: string;
  companyId: string;
  status: PayRunStatus;
  note: string | null;
  itemCount: number;
  approvedCount: number;
  flaggedCount: number;
  rejectedCount: number;
  totalSrcMinor: number; // sum of child srcAmountMinor (mixed currencies noted per item)
  createdAt: string;
  payments?: Payment[]; // present on the detail view
}

// Recurring payout schedule (retainer). Runs create a normal payment via the
// same orchestrator each period; nextRunAt advances by the cadence.
export interface PayoutSchedule {
  id: string;
  companyId: string;
  payeeId: string;
  payeeName?: string;
  srcCurrency: Currency;
  dstCurrency: Currency;
  srcAmountMinor: number;
  purposeCode: PurposeCode;
  cadence: Cadence;
  active: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  runCount: number;
  createdAt: string;
}

// Result of submitting KYC/KYB for verification (self-serve onboarding).
// A submission can be REJECTED (sanctions hit, bad document) — the reason drives
// the failing-KYC screen and the resubmit path.
export interface VerificationResult {
  userId: string;
  status: KycStatus;
  reason: string | null; // populated when status === 'REJECTED'
  credentialHash: string | null; // keccak256 mirrored to IdentityRegistry when VERIFIED
  walletAddress: string | null; // provisioned on verification
}

// A managed party (customer) in the platform — company or freelancer.
export interface CustomerSummary {
  id: string;
  role: Role;
  name: string;
  email: string;
  country: string;
  status: KycStatus; // KYC (freelancer) or KYB (company); 'VERIFIED' for admins
  verified: boolean;
  walletAddress: string | null;
  createdAt: string;
  paymentsCount?: number;
}

// A freelancer's payout destination — where the off-ramped fiat actually lands.
// A payment cannot settle to a payee with no active account for the dst currency.
export interface PayoutAccount {
  id: string;
  userId: string;
  label: string;
  currency: Currency;
  accountName: string;
  accountNumberMasked: string; // only last 4 shown
  bankIdentifier: string;
  active: boolean;
  createdAt: string;
}

// A dispute opened on a payment. While OPEN the payment sits in DISPUTED.
export interface Dispute {
  id: string;
  paymentId: string;
  raisedById: string;
  raisedByRole: Role;
  reason: string;
  status: DisputeStatus;
  resolutionNote: string | null;
  resolvedById: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AdminMetrics {
  volume24hMinorUsd: number;
  revenueMinorUsd: number;
  activeCorridors: number;
  avgSettlementSeconds: number;
  flaggedPct: number;
}

// Downloadable documents for a payment. The backend owns the availability rules
// so the UI can render its document controls straight from the descriptor.
export interface PaymentDocument {
  kind: 'receipt' | 'compliance' | 'firc';
  title: string;
  url: string; // ready-to-fetch API path, e.g. /api/v1/payments/<id>/firc.pdf
  available: boolean;
  reason?: string; // why it is not yet available (for a disabled control's tooltip)
}

// A payable freelancer, as the company's roster and the payout wizard's payee
// picker see them (FR-6.1). payoutCurrencies lists the currencies they have an
// active payout account in — a payment to a currency not in this list will land
// in PAYOUT_FAILED, so the UI can warn before the company confirms.
export interface FreelancerSummary {
  id: string;
  name: string;
  country: string;
  kycStatus: KycStatus;
  walletAddress: string | null;
  payoutCurrencies: Currency[];
  payable: boolean; // verified AND has at least one active payout account
}
