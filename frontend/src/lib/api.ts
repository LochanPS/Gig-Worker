// Typed API client against the REAL backend (BUILD_CONTRACTS §4). JWT in localStorage.
import type {
  Payment, FxQuote, Alert, AdminMetrics, Invoice, User, Role,
  PayRun, PayoutSchedule, VerificationResult, CreatePayRunInput, CreateScheduleInput,
  PayoutAccount, Dispute, AddPayoutAccountInput, FreelancerSummary, EscrowMode,
  CustomerSummary, CreateCustomerInput, Notification, Credential, PaymentDocument,
  AdjudicationSummary, Treasury, SystemInfo, UpdateWalletInput,
} from '@gigbridge/shared';

// In dev, Vite proxies /api -> backend:4000 (relative base works).
// In prod (frontend and backend on different origins), VITE_API_BASE sets the
// backend origin. If it's not set on a hosted build, fall back to the known
// Railway backend so the site still works instead of POSTing to its own origin
// (which the SPA rewrite answers with a confusing 405). Override with the env var.
const DEFAULT_HOSTED_API = 'https://gigbridgebackend-production.up.railway.app';
const onLocalhost = typeof location !== 'undefined' && /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname);
const CONFIGURED = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const API_ORIGIN = CONFIGURED || (onLocalhost ? '' : DEFAULT_HOSTED_API);
const BASE = `${API_ORIGIN}/api/v1`;
const TOKEN_KEY = 'gb_token';

const API_MISCONFIGURED = false; // a hosted build always resolves to DEFAULT_HOSTED_API

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  if (API_MISCONFIGURED) {
    throw new Error('Backend not configured: set VITE_API_BASE to your API URL (e.g. your Railway backend) and redeploy the frontend.');
  }
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...opts,
      headers: {
        'content-type': 'application/json',
        ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}),
        ...(opts.headers ?? {}),
      },
    });
  } catch {
    throw new Error(`Cannot reach the API at ${API_ORIGIN || location.origin}. Is the backend up and VITE_API_BASE correct?`);
  }
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

  // customers (parties: companies + freelancers)
  customers: (role?: 'COMPANY' | 'FREELANCER') => req<CustomerSummary[]>(`/customers${role ? `?role=${role}` : ''}`),
  customer: (id: string) => req<CustomerSummary>(`/customers/${id}`),
  createCustomer: (body: CreateCustomerInput) => req<CustomerSummary>('/customers', { method: 'POST', body: JSON.stringify(body) }),
  verifyCustomer: (id: string) => req<{ id: string }>(`/admin/verify/${id}`, { method: 'POST', body: JSON.stringify({}) }),
  // Repoint an existing party at a different settlement wallet — swapping a
  // generated demo wallet for a funded account, without re-seeding.
  updateCustomerWallet: (id: string, body: UpdateWalletInput) =>
    req<CustomerSummary>(`/customers/${id}/wallet`, { method: 'POST', body: JSON.stringify(body) }),

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

  // notifications (FR-7.1) — the bell menu and toasts
  notifications: (all = false) => req<Notification[]>(`/notifications${all ? '?all=true' : ''}`),
  unreadCount: () => req<{ count: number }>('/notifications/unread-count'),
  markNotificationRead: (id: string) => req<Notification>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => req<{ marked: number }>('/notifications/read-all', { method: 'POST' }),

  // identity — the signed-in user's verifiable credential (404 when unverified)
  myCredential: () => req<Credential>('/credentials/me'),

  // documents: the backend owns which are available and why, so the UI renders
  // its controls straight from this descriptor rather than guessing.
  paymentDocuments: (id: string) => req<PaymentDocument[]>(`/payments/${id}/documents`),

  // What the backend is really doing when it settles: real on-chain transactions
  // or a simulation. Drives the settlement badge, so a fabricated tx hash is never
  // presented as a chain transaction.
  systemInfo: () => req<SystemInfo>('/system/info'),

  // admin
  queue: () => req<Array<Record<string, unknown>>>('/admin/queue'),
  resolveFlag: (id: string, action: 'APPROVE' | 'REJECT', note: string) =>
    req<Payment>(`/admin/queue/${id}/resolve`, { method: 'POST', body: JSON.stringify({ action, note }) }),
  alerts: () => req<Alert[]>('/admin/alerts'),
  metrics: () => req<AdminMetrics>('/admin/metrics'),
  adjudications: () => req<AdjudicationSummary>('/admin/adjudications'),
  treasury: () => req<Treasury>('/admin/treasury'),
  rules: () => req<Array<{ id: string; jurisdiction: string; severity: string; legalRef: string }>>('/admin/rules'),
  // Sweep rate locks past their window now. The same sweep runs on a timer in the
  // backend; exposing it makes the EXPIRED state demonstrable instead of a wait.
  expireLocks: () => req<{ expired: number; paymentIds: string[] }>('/admin/expire-locks', { method: 'POST' }),
};
