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

// Descriptor for a document the backend can render for a payment. The backend is
// the single source of truth for availability (receipt/FIRC need COMPLETED, FIRC
// needs INR, compliance needs a decision) so the UI never re-encodes those rules.
export interface PaymentDocument {
  kind: 'receipt' | 'compliance' | 'firc';
  title: string;
  url: string; // ready-to-fetch API path, e.g. /api/v1/payments/<id>/firc.pdf
  available: boolean;
  reason?: string; // why it is not yet available (for a disabled control's tooltip)
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

export interface AdminMetrics {
  volume24hMinorUsd: number;
  revenueMinorUsd: number;
  activeCorridors: number;
  avgSettlementSeconds: number;
  flaggedPct: number;
}
