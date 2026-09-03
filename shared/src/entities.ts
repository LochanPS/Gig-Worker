/**
 * GigBridge domain entities (TRD 4.1 data model), as transport-shaped types.
 *
 * Conventions:
 *  - All ids are string (cuid/uuid).
 *  - All timestamps are ISO-8601 strings (JSON transport, never Date on the wire).
 *  - Fiat display amounts are `number`; on-chain token amounts are `string`
 *    (base units / wei — never a float).
 */

import type {
  AlertSeverity,
  AlertType,
  Currency,
  Direction,
  EscrowState,
  FxPair,
  InvoiceState,
  Jurisdiction,
  PaymentState,
  PayoutPreference,
  PurposeCode,
  Role,
  RuleSeverity,
  Verdict,
  VerificationStatus,
} from "./enums.js";

export interface User {
  id: string;
  role: Role;
  email: string;
  country: string; // ISO-3166 alpha-2
  walletAddress: string | null;
  createdAt: string;
}

export interface CompanyProfile {
  userId: string;
  legalName: string;
  regNumber: string;
  country: string;
  kybStatus: VerificationStatus;
}

export interface FreelancerProfile {
  userId: string;
  fullName: string;
  country: string;
  panOrTaxId: string | null;
  kycStatus: VerificationStatus;
  payoutPreference: PayoutPreference;
}

export interface Credential {
  id: string;
  userId: string;
  did: string;
  /** Off-chain VC document; PII stays here, never on-chain (NFR-3). */
  credentialJson: Record<string, unknown>;
  /** keccak256 hash mirrored to IdentityRegistry.sol. */
  hash: string;
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
}

export interface FxRate {
  id: string;
  pair: FxPair;
  midRate: number;
  lockedRate: number | null;
  lockedUntil: string | null;
  source: string;
  fetchedAt: string;
}

export interface Payment {
  id: string;
  companyId: string;
  freelancerId: string;
  srcCurrency: Currency;
  dstCurrency: Currency;
  srcAmount: number;
  dstAmount: number;
  feeAmount: number;
  fxRateId: string | null;
  purposeCode: PurposeCode | null;
  invoiceRef: string | null;
  state: PaymentState;
  complianceDecisionId: string | null;
  /** bytes32 payment id inside EscrowVault.sol. */
  escrowPaymentId: string | null;
  txHashFund: string | null;
  txHashRelease: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RuleResult {
  ruleId: string;
  jurisdiction: Jurisdiction;
  direction: Direction;
  severity: RuleSeverity;
  passed: boolean;
  legalRef: string;
  message: string;
}

export interface ComplianceDecision {
  id: string;
  paymentId: string;
  verdict: Verdict;
  ruleResults: RuleResult[];
  /** LLM (or template) plain-English reasoning trace. */
  agentExplanation: string | null;
  /** AuditAnchor.sol tx hash for the decision-JSON hash. */
  anchorTxHash: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface Alert {
  id: string;
  type: AlertType;
  paymentId: string | null;
  severity: AlertSeverity;
  details: Record<string, unknown>;
  resolved: boolean;
  createdAt: string;
}

export interface Invoice {
  id: string;
  freelancerId: string;
  companyId: string;
  amount: number;
  currency: Currency;
  memo: string | null;
  state: InvoiceState;
  paymentId: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

/** Escrow view derived from on-chain state; surfaced on payment timelines. */
export interface EscrowInfo {
  escrowPaymentId: string;
  state: EscrowState;
  amount: string;
  feeAmount: string;
  complianceHash: string;
  txHashFund: string | null;
  txHashRelease: string | null;
}
