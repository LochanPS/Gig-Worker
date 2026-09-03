// Typed API client against the REAL backend (BUILD_CONTRACTS §4). JWT in localStorage.
import type {
  Payment, FxQuote, Alert, AdminMetrics, Invoice, User, Role,
} from '@gigbridge/shared';

const BASE = '/api/v1';
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
  register: (input: { email: string; password: string; role: Role; country: string; name: string }) =>
    req<AuthResult>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  me: () => req<User>('/auth/me'),

  // fx
  quote: (pair: string, amountMinor: number) =>
    req<FxQuote>(`/fx/quote?pair=${pair}&amount=${amountMinor}`),
  fxHistory: (pair: string, days = 30) =>
    req<{ date: string; rate: number }[]>(`/fx/history?pair=${pair}&days=${days}`),

  // payments
  payments: () => req<Payment[]>('/payments'),
  payment: (id: string) => req<Payment>(`/payments/${id}`),
  createPayment: (body: { payeeId: string; srcCurrency: string; dstCurrency: string; srcAmountMinor: number; purposeCode: string; invoiceRef?: string }) =>
    req<{ payment: Payment; quote: FxQuote; decision: { verdict: string; agentExplanation: string } }>('/payments', { method: 'POST', body: JSON.stringify(body) }),
  confirmPayment: (id: string, quoteId: string) =>
    req<Payment>(`/payments/${id}/confirm`, { method: 'POST', body: JSON.stringify({ quoteId }) }),

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
