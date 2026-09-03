/**
 * REST API contract (TRD 4.3). Endpoint paths as constants + response payload
 * shapes. Request bodies live in schemas.ts (zod). This file is the map P3
 * generates the mock API server from and both sides import for type safety.
 */

import type {
  Alert,
  ComplianceDecision,
  Credential,
  EscrowInfo,
  Invoice,
  Payment,
  User,
} from "./entities.js";
import type { PaymentState, Verdict } from "./enums.js";

export const API_PREFIX = "/api/v1";

export const ENDPOINTS = {
  auth: {
    register: "POST /auth/register",
    login: "POST /auth/login",
    me: "GET /auth/me",
  },
  identity: {
    kycSubmit: "POST /kyc/submit",
    kybSubmit: "POST /kyb/submit",
    myCredentials: "GET /credentials/me",
    adminVerify: "POST /admin/verify/:userId",
  },
  payments: {
    create: "POST /payments",
    confirm: "POST /payments/:id/confirm",
    release: "POST /payments/:id/release",
    refund: "POST /payments/:id/refund",
    list: "GET /payments",
    timeline: "GET /payments/:id/timeline",
    receiptPdf: "GET /payments/:id/receipt.pdf",
    compliancePdf: "GET /payments/:id/compliance.pdf",
  },
  invoices: {
    create: "POST /invoices",
    approve: "POST /invoices/:id/approve",
    list: "GET /invoices",
  },
  fx: {
    quote: "GET /fx/quote",
    history: "GET /fx/history",
  },
  admin: {
    queue: "GET /admin/queue",
    resolve: "POST /admin/queue/:id/resolve",
    alerts: "GET /admin/alerts",
    metrics: "GET /admin/metrics",
    rules: "GET /admin/rules",
  },
} as const;

// ---- Auth responses ---------------------------------------------------------

export interface AuthResponse {
  token: string;
  user: User;
}

export interface MeResponse {
  user: User;
  kycStatus?: string;
  kybStatus?: string;
}

// ---- Payment responses ------------------------------------------------------

export interface TimelineStep {
  state: PaymentState;
  label: string;
  at: string | null;
  txHash: string | null;
  done: boolean;
}

export interface PaymentTimelineResponse {
  payment: Payment;
  steps: TimelineStep[];
  escrow: EscrowInfo | null;
  decision: ComplianceDecision | null;
}

export interface ListPaymentsResponse {
  payments: Payment[];
}

// ---- FX responses -----------------------------------------------------------

export interface FxHistoryPoint {
  at: string;
  rate: number;
}

export interface FxHistoryResponse {
  pair: string;
  points: FxHistoryPoint[];
}

// ---- Identity responses -----------------------------------------------------

export interface CredentialsResponse {
  credentials: Credential[];
}

// ---- Admin responses --------------------------------------------------------

export interface QueueItem {
  payment: Payment;
  decision: ComplianceDecision;
}

export interface AdminQueueResponse {
  items: QueueItem[];
}

export interface AdminAlertsResponse {
  alerts: Alert[];
}

export interface CorridorMetric {
  pair: string;
  volume: number;
  count: number;
  feeRevenue: number;
  avgSettlementSeconds: number;
}

export interface AdminMetricsResponse {
  totalVolume: number;
  totalFeeRevenue: number;
  paymentCount: number;
  flaggedRate: number;
  corridors: CorridorMetric[];
}

export interface RuleDescriptor {
  id: string;
  jurisdiction: string;
  direction: string;
  severity: string;
  legalRef: string;
  message: string;
}

export interface AdminRulesResponse {
  rules: RuleDescriptor[];
}

export interface InvoicesResponse {
  invoices: Invoice[];
}

// ---- Generic error ----------------------------------------------------------

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

/** Verdict -> resulting payment state, for the orchestrator + UI. */
export const VERDICT_TO_STATE: Record<Verdict, PaymentState> = {
  APPROVE: "APPROVED",
  FLAG: "FLAGGED",
  REJECT: "REJECTED",
};
