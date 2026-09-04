// Typed API client against the REAL backend (BUILD_CONTRACTS §4). JWT in localStorage.
import type {
  Payment, FxQuote, Alert, AdminMetrics, Invoice, User, Role,
  PayRun, PayoutSchedule, VerificationResult, CreatePayRunInput, CreateScheduleInput,
  PayoutAccount, Dispute, AddPayoutAccountInput, FreelancerSummary, EscrowMode,
} from '@gigbridge/shared';

// In dev, Vite proxies /api -> backend:4000 (relative base works).
// In prod (frontend and backend on different origins), set VITE_API_BASE to the
// backend origin, e.g. https://gigbridge-api.up.railway.app
const API_ORIGIN = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const BASE = `${API_ORIGIN}/api/v1`;
const TOKEN_KEY = 'gb_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface AuthResult { token: string; user: User; }

export const api = {
  // auth
  login: (email: string, password: string) =>
    req<AuthResult>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (input: { email: string; password: string; role: Role; country: string; name: string; legalName?: string; regNumber?: string; panOrTaxId?: string }) =>
    req<AuthResult>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  me: () => req<User>('/auth/me'),

  // verification / onboarding (FR-1)
  verificationStatus: () => req<VerificationResult>('/verification/me'),
  submitKyc: (body: { panOrTaxId: string; documentType: string; documentRef: string }) =>
    req<VerificationResult>('/verification/kyc', { method: 'POST', body: JSON.stringify(body) }),
  submitKyb: (body: { legalName: string; regNumber: string; country: string }) =>
    req<VerificationResult>('/verification/kyb', { method: 'POST', body: JSON.stringify(body) }),

  // freelancer roster (FR-6.1) — the payout wizard's payee list
  freelancers: () => req<FreelancerSummary[]>('/directory/freelancers'),

  // batch pay-run (FR-2.5)
  payRuns: () => req<PayRun[]>('/payruns'),
  payRun: (id: string) => req<PayRun>(`/payruns/${id}`),
  createPayRun: (body: CreatePayRunInput) => req<PayRun>('/payruns', { method: 'POST', body: JSON.stringify(body) }),
  confirmPayRun: (id: string) => req<PayRun>(`/payruns/${id}/confirm`, { method: 'POST' }),

  // recurring payouts
  schedules: () => req<PayoutSchedule[]>('/schedules'),
  createSchedule: (body: CreateScheduleInput) => req<PayoutSchedule>('/schedules', { method: 'POST', body: JSON.stringify(body) }),
  pauseSchedule: (id: string) => req<PayoutSchedule>(`/schedules/${id}/pause`, { method: 'POST' }),
  resumeSchedule: (id: string) => req<PayoutSchedule>(`/schedules/${id}/resume`, { method: 'POST' }),
  runDueSchedules: () => req<{ ran: number; fired: { scheduleId: string; paymentId: string; verdict: string }[] }>('/schedules/run-due', { method: 'POST' }),

  // fx
  quote: (pair: string, amountMinor: number) =>
    req<FxQuote>(`/fx/quote?pair=${pair}&amount=${amountMinor}`),
  fxHistory: (pair: string, days = 30) =>
    req<{ date: string; rate: number }[]>(`/fx/history?pair=${pair}&days=${days}`),

  // payments
  payments: () => req<Payment[]>('/payments'),
  payment: (id: string) => req<Payment>(`/payments/${id}`),
  createPayment: (body: { payeeId: string; srcCurrency: string; dstCurrency: string; srcAmountMinor: number; purposeCode: string; invoiceRef?: string; escrowMode?: EscrowMode }) =>
    req<{ payment: Payment; quote: FxQuote; decision: { verdict: string; agentExplanation: string } }>('/payments', { method: 'POST', body: JSON.stringify(body) }),
  confirmPayment: (id: string, quoteId: string) =>
    req<Payment>(`/payments/${id}/confirm`, { method: 'POST', body: JSON.stringify({ quoteId }) }),
  retryPayout: (id: string, quoteId: string) =>
    req<Payment>(`/payments/${id}/retry`, { method: 'POST', body: JSON.stringify({ quoteId }) }),
  // Release a held escrow once the work is approved (FR-2.2), or refund it.
  releasePayment: (id: string) => req<Payment>(`/payments/${id}/release`, { method: 'POST' }),
  refundPayment: (id: string) => req<Payment>(`/payments/${id}/refund`, { method: 'POST' }),

  // payout methods (add bank account)
  payoutAccounts: () => req<PayoutAccount[]>('/payout-accounts'),
  addPayoutAccount: (body: AddPayoutAccountInput) => req<PayoutAccount>('/payout-accounts', { method: 'POST', body: JSON.stringify(body) }),
  removePayoutAccount: (id: string) => req<PayoutAccount>(`/payout-accounts/${id}/remove`, { method: 'POST' }),

  // disputes & reversals
  disputes: () => req<Dispute[]>('/disputes'),
  raiseDispute: (paymentId: string, reason: string) => req<Dispute>('/disputes', { method: 'POST', body: JSON.stringify({ paymentId, reason }) }),
  resolveDispute: (id: string, action: 'REFUND' | 'DISMISS', note: string) =>
    req<Dispute>(`/disputes/${id}/resolve`, { method: 'POST', body: JSON.stringify({ action, note }) }),

  // invoices
  invoices: () => req<Invoice[]>('/invoices'),
  createInvoice: (body: { companyId: string; amountMinor: number; currency: string; memo: string }) =>
    req<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(body) }),
  approveInvoice: (id: string) => req<{ invoice: Invoice; payment: Payment }>(`/invoices/${id}/approve`, { method: 'POST' }),

  // admin
  queue: () => req<Array<Record<string, unknown>>>('/admin/queue'),
  resolveFlag: (id: string, action: 'APPROVE' | 'REJECT', note: string) =>
    req<Payment>(`/admin/queue/${id}/resolve`, { method: 'POST', body: JSON.stringify({ action, note }) }),
  alerts: () => req<Alert[]>('/admin/alerts'),
  metrics: () => req<AdminMetrics>('/admin/metrics'),
  rules: () => req<Array<{ id: string; jurisdiction: string; severity: string; legalRef: string }>>('/admin/rules'),
};
