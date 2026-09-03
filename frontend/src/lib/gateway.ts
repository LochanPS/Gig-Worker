// Typed endpoint helpers over the api client. One place per contract call.
import type {
  Alert,
  AdminMetrics,
  Credential,
  FxQuote,
  Payment,
  PurposeCode,
  RuleResult,
} from '@gigbridge/shared';
import { api, qs } from './api';

export interface FxHistoryPoint {
  date: string;
  rate: number;
}

// Mid-market rates mirrored from the mock quote engine, used to fill derived
// amounts the mock leaves null on created payments (dst amount, fee). Display
// only; the real backend persists these.
const RATE: Record<string, number> = { EURINR: 90.24, USDINR: 83.1, INRUSD: 0.012 };

function hydrate(p: Payment): Payment {
  if (p.feeAmountMinor != null && p.dstAmountMinor != null) return p;
  const fee = p.feeAmountMinor ?? Math.max(Math.round(p.srcAmountMinor * 0.0075), 100);
  const gas = 40;
  const rate = RATE[`${p.srcCurrency}${p.dstCurrency}`] ?? 1;
  const dst = p.dstAmountMinor ?? Math.round((p.srcAmountMinor - fee - gas) * rate);
  return { ...p, feeAmountMinor: fee, dstAmountMinor: dst };
}

export const gateway = {
  listPayments: () => api.get<Payment[]>('/payments').then((ps) => ps.map(hydrate)),
  getPayment: (id: string) => api.get<Payment>(`/payments/${id}`).then(hydrate),

  getQuote: (pair: string, amountMinor: number) =>
    api.get<FxQuote>(`/fx/quote${qs({ pair, amount: amountMinor })}`),
  fxHistory: (pair: string, days = 30) =>
    api.get<FxHistoryPoint[]>(`/fx/history${qs({ pair, days })}`),

  createPayment: (body: {
    payeeId: string;
    srcCurrency: string;
    dstCurrency: string;
    srcAmountMinor: number;
    purposeCode: PurposeCode;
    invoiceRef?: string | null;
  }) => api.post<Payment>('/payments', body),

  confirmPayment: (id: string, quoteId: string) =>
    api.post<Payment>(`/payments/${id}/confirm`, { quoteId }),
  refundPayment: (id: string, reason: string) =>
    api.post<Payment>(`/payments/${id}/refund`, { reason }),

  adminQueue: () => api.get<Payment[]>('/admin/queue'),
  resolveCase: (id: string, action: 'APPROVE' | 'REJECT' | 'REQUEST_DOCS', note: string) =>
    api.post<{ ok: boolean }>(`/admin/queue/${id}/resolve`, { action, note }),
  adminAlerts: () => api.get<Alert[]>('/admin/alerts'),
  adminMetrics: () => api.get<AdminMetrics>('/admin/metrics'),
  adminRules: () => api.get<RuleResult[]>('/admin/rules'),

  credentialMe: () => api.get<Credential>('/credentials/me'),

  createInvoice: (body: { companyId: string; amountMinor: number; currency: string; memo: string; reference?: string }) =>
    api.post<{ id: string; status: string }>('/invoices', body),
  approveInvoice: (id: string) => api.post<{ ok: boolean }>(`/invoices/${id}/approve`),
};
