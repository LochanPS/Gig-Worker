// Seed-shaped fixtures for the mock server (BUILD_CONTRACTS §7).
// Same names/logins the real seed script will use, so P3's UI is drop-in compatible.
import type {
  User, Payment, FxQuote, Alert, ComplianceDecision, AdminMetrics, TimelineStep,
} from '@gigbridge/shared';

export const users: Record<string, User & { password: string }> = {
  novatek: {
    id: '11111111-1111-1111-1111-111111111111', role: 'COMPANY', email: 'novatek@demo.gg',
    password: 'demo1234', country: 'DE', name: 'Novatek GmbH',
    walletAddress: '0xNovatek0000000000000000000000000000001', createdAt: '2026-08-01T09:00:00Z',
  },
  chennai: {
    id: '22222222-2222-2222-2222-222222222222', role: 'COMPANY', email: 'chennai@demo.gg',
    password: 'demo1234', country: 'IN', name: 'Chennai Softworks',
    walletAddress: '0xChennai0000000000000000000000000000002', createdAt: '2026-08-01T09:00:00Z',
  },
  priya: {
    id: '33333333-3333-3333-3333-333333333333', role: 'FREELANCER', email: 'priya@demo.gg',
    password: 'demo1234', country: 'IN', name: 'Priya Sharma',
    walletAddress: '0xPriya00000000000000000000000000000003', createdAt: '2026-08-01T09:00:00Z',
  },
  alex: {
    id: '44444444-4444-4444-4444-444444444444', role: 'FREELANCER', email: 'alex@demo.gg',
    password: 'demo1234', country: 'US', name: 'Alex Carter',
    walletAddress: '0xAlex000000000000000000000000000000004', createdAt: '2026-08-01T09:00:00Z',
  },
  uma: {
    id: '55555555-5555-5555-5555-555555555555', role: 'FREELANCER', email: 'uma@demo.gg',
    password: 'demo1234', country: 'IN', name: 'Uma Rao',
    walletAddress: null, createdAt: '2026-08-20T09:00:00Z',
  },
  admin: {
    id: '99999999-9999-9999-9999-999999999999', role: 'ADMIN', email: 'admin@demo.gg',
    password: 'demo1234', country: 'IN', name: 'Platform Admin',
    walletAddress: null, createdAt: '2026-08-01T09:00:00Z',
  },
};

function fullTimeline(): TimelineStep[] {
  const t = '2026-09-01T10:00:00Z';
  return [
    { key: 'CREATED', label: 'Payment created', state: 'DRAFT', at: t, actor: 'Novatek GmbH' },
    { key: 'COMPLIANCE_APPROVED', label: 'Compliance approved', state: 'COMPLIANCE_CHECK', at: t, actor: 'Agent' },
    { key: 'RATE_LOCKED', label: 'FX rate locked', state: 'RATE_LOCKED', at: t, actor: 'FX engine' },
    { key: 'FUNDED', label: 'Escrow funded', state: 'FUNDED', at: t, actor: 'Novatek GmbH', txHash: '0xabc123def4567890000000000000000000000000000000000000000000000001' },
    { key: 'SETTLING', label: 'Settling', state: 'SETTLING', at: t, actor: 'Settlement' },
    { key: 'RELEASED', label: 'Released to payee', state: 'COMPLETED', at: t, actor: 'Platform', txHash: '0xdef456abc7890123000000000000000000000000000000000000000000000002' },
    { key: 'CREDITED', label: 'Payee credited', state: 'COMPLETED', at: t, actor: 'Off-ramp' },
  ];
}

export const payments: Payment[] = [
  {
    id: 'aaaaaaa1-0000-0000-0000-000000000001',
    companyId: users.novatek.id, companyName: users.novatek.name, freelancerId: users.priya.id, freelancerName: users.priya.name,
    srcCurrency: 'EUR', dstCurrency: 'INR', srcAmountMinor: 50000, dstAmountMinor: 4512000,
    feeAmountMinor: 375, fxRateId: 'fx-1', purposeCode: 'P0802', invoiceRef: 'INV-1001',
    state: 'COMPLETED', escrowId: '0xescrow01', escrowMode: 'INSTANT', complianceDecisionId: 'cd-1',
    txHashFund: '0xabc123def4567890000000000000000000000000000000000000000000000001',
    txHashRelease: '0xdef456abc7890123000000000000000000000000000000000000000000000002',
    createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:47Z', timeline: fullTimeline(),
  },
];

export function makeQuote(pair: string, amountMinor: number): FxQuote {
  const rates: Record<string, number> = { EURINR: 90.24, USDINR: 83.1, INRUSD: 0.012 };
  const midRate = rates[pair] ?? 1;
  const feeMinor = Math.max(Math.round(amountMinor * 0.0075), 100);
  const gasEstimateMinor = 40;
  const payeeReceivesMinor = Math.round((amountMinor - feeMinor - gasEstimateMinor) * midRate);
  return {
    quoteId: '66666666-6666-6666-6666-666666666666', pair, midRate,
    srcAmountMinor: amountMinor, feeMinor, gasEstimateMinor, payeeReceivesMinor,
    incumbentFeeMinor: Math.round(amountMinor * 0.09),
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  };
}

export const alerts: Alert[] = [
  {
    id: 'alert-1', type: 'STRUCTURING', severity: 'HIGH', paymentId: null,
    details: { pattern: '3 payments of EUR 9,400 within 72h', payer: 'Novatek GmbH' },
    resolved: false, createdAt: '2026-09-02T14:00:00Z',
  },
];

export const decisions: ComplianceDecision[] = [
  {
    id: 'cd-1', paymentId: payments[0].id, verdict: 'APPROVE',
    ruleResults: [
      { ruleId: 'IN-RBI-001', jurisdiction: 'INDIA', passed: true, severity: 'BLOCK', legalRef: 'FEMA', message: 'Purpose code P0802 present for inward remittance.' },
      { ruleId: 'EU-AML-001', jurisdiction: 'EU', passed: true, severity: 'FLAG', legalRef: 'AMLD', message: 'Below EUR 10,000 EDD threshold.' },
      { ruleId: 'US-OFAC-001', jurisdiction: 'US', passed: true, severity: 'BLOCK', legalRef: 'OFAC', message: 'No sanctions match on either party.' },
    ],
    agentExplanation:
      'This EUR 500 payment from Novatek GmbH (Germany, verified) to Priya Sharma (India, verified) for software services falls under FEMA purpose code P0802. It is below the EUR 10,000 enhanced-due-diligence threshold, both parties clear sanctions screening, and Priya has a valid PAN on file. Approved for settlement.',
    anchorTxHash: '0xanchor00000000000000000000000000000000000000000000000000000000cd1',
    reviewedBy: null, reviewNote: null, createdAt: '2026-09-01T10:00:03Z',
  },
];

export const metrics: AdminMetrics = {
  volume24hMinorUsd: 1_284_00, revenueMinorUsd: 9_63, activeCorridors: 3,
  avgSettlementSeconds: 47, flaggedPct: 4.2,
};
