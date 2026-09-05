// Document service (step 10). Generates print-ready HTML for a payment receipt and
// a compliance report. The browser turns these into PDF via print-to-PDF, so there
// is no heavy PDF dependency (roadmap: PDFs are lowest priority, keep it demo-safe).
import { prisma } from '../../lib/db.js';
import type { RuleResult, PurposeCode, PaymentState, PaymentDocument } from '@gigbridge/shared';
import { PURPOSE_CODE_LABELS } from '@gigbridge/shared';

// Which documents exist for a payment, and whether each is available yet. The
// backend owns these rules so the UI can render buttons straight from the result
// (pure — unit-tested without a DB). URLs are ready to fetch under /api/v1.
export function paymentDocuments(p: {
  id: string;
  state: PaymentState;
  dstCurrency: string;
  hasDecision: boolean;
}): PaymentDocument[] {
  const url = (kind: string) => `/api/v1/payments/${p.id}/${kind}.pdf`;
  const completed = p.state === 'COMPLETED';
  const notCompletedReason = 'Available once the payment is completed';
  return [
    {
      kind: 'compliance',
      title: 'Compliance report',
      url: url('compliance'),
      available: p.hasDecision,
      ...(p.hasDecision ? {} : { reason: 'Compliance has not run yet' }),
    },
    {
      kind: 'receipt',
      title: 'Receipt',
      url: url('receipt'),
      available: completed,
      ...(completed ? {} : { reason: notCompletedReason }),
    },
    {
      kind: 'firc',
      title: 'FIRC (remittance certificate)',
      url: url('firc'),
      available: completed && p.dstCurrency === 'INR',
      ...(completed
        ? p.dstCurrency === 'INR'
          ? {}
          : { reason: 'Only for remittances credited in INR' }
        : { reason: notCompletedReason }),
    },
  ];
}

const money = (minor: number | null | undefined, ccy: string) =>
  minor == null ? '—' : `${ccy} ${(minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export const shell = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(title)}</title>
<style>
 @page{margin:22mm}
 body{font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#0f1720;max-width:720px;margin:32px auto;padding:0 20px}
 .brand{display:flex;align-items:baseline;justify-content:space-between;border-bottom:2px solid #0e9488;padding-bottom:10px;margin-bottom:22px}
 .brand h1{font-size:20px;margin:0;letter-spacing:-.01em}
 .brand .tag{color:#0e9488;font-weight:600;font-size:12px;letter-spacing:.14em;text-transform:uppercase}
 h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#475264;margin:26px 0 8px}
 table{width:100%;border-collapse:collapse;font-size:13px}
 td{padding:6px 0;vertical-align:top}
 td.k{color:#475264;width:42%}
 td.v{text-align:right;font-variant-numeric:tabular-nums}
 .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;word-break:break-all}
 .total{border-top:1px solid #d3dae2;font-weight:700}
 .rule{border:1px solid #e2e8f0;border-radius:6px;padding:9px 11px;margin:7px 0}
 .rule b{font-family:ui-monospace,monospace;font-size:11px}
 .pass{color:#0e9488}.fail{color:#d64541}
 .verdict{display:inline-block;padding:4px 12px;border-radius:999px;font-weight:700;font-size:12px;letter-spacing:.06em}
 .v-APPROVE{background:#d4efec;color:#0e7c72}.v-FLAG{background:#fbecd2;color:#9a5f08}.v-REJECT{background:#f9dedd;color:#b5322e}
 .agent{background:#f6f8fa;border-left:3px solid #0e9488;padding:11px 14px;border-radius:4px;color:#2b3543;font-size:13px}
 .stmt{background:#f6f8fa;border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px;margin:18px 0;color:#2b3543;line-height:1.6}
 .seal{margin-top:34px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px}
 .seal .sig{border-top:1px solid #98a6b8;padding-top:6px;font-size:12px;color:#475264;min-width:210px;text-align:center}
 .badge{display:inline-block;border:1px dashed #0e9488;color:#0e7c72;border-radius:6px;padding:2px 8px;font-size:10px;letter-spacing:.12em;text-transform:uppercase}
 .foot{margin-top:30px;border-top:1px solid #d3dae2;padding-top:10px;color:#8695a6;font-size:11px}
</style></head><body>${body}
<div class="foot">GigBridge — autonomous cross-border payment gateway. This document is generated from immutable on-chain and ledger records. Amounts in minor units are reconciled to the settlement transaction.</div>
</body></html>`;

async function loadPayment(id: string) {
  return prisma.payment.findUniqueOrThrow({
    where: { id },
    include: { company: true, freelancer: true, decision: true, fxRate: true },
  });
}

export async function receiptHtml(paymentId: string): Promise<string> {
  const p = await loadPayment(paymentId);
  const body = `
  <div class="brand"><h1>Payment Receipt</h1><span class="tag">GigBridge</span></div>
  <table>
    <tr><td class="k">Receipt / Payment ID</td><td class="v mono">${esc(p.id)}</td></tr>
    <tr><td class="k">Date</td><td class="v">${esc(p.createdAt.toISOString().slice(0, 10))}</td></tr>
    <tr><td class="k">Status</td><td class="v">${esc(p.state)}</td></tr>
    ${p.invoiceRef ? `<tr><td class="k">Invoice reference</td><td class="v mono">${esc(p.invoiceRef)}</td></tr>` : ''}
  </table>
  <h2>Parties</h2>
  <table>
    <tr><td class="k">From (payer)</td><td class="v">${esc(p.company.name)} · ${esc(p.company.country)}</td></tr>
    <tr><td class="k">To (payee)</td><td class="v">${esc(p.freelancer.name)} · ${esc(p.freelancer.country)}</td></tr>
    <tr><td class="k">Purpose code</td><td class="v">${esc(p.purposeCode ?? '—')}</td></tr>
  </table>
  <h2>Amounts</h2>
  <table>
    <tr><td class="k">Amount sent</td><td class="v">${money(p.srcAmountMinor, p.srcCurrency)}</td></tr>
    <tr><td class="k">FX rate (${esc(p.srcCurrency)}→${esc(p.dstCurrency)})</td><td class="v">${p.fxRate ? p.fxRate.midRate.toFixed(4) : '—'}</td></tr>
    <tr><td class="k">Platform fee (0.75%)</td><td class="v">${money(p.feeAmountMinor, p.srcCurrency)}</td></tr>
    <tr class="total"><td class="k">Net received by payee</td><td class="v">${money(p.dstAmountMinor, p.dstCurrency)}</td></tr>
  </table>
  <h2>Settlement (on-chain)</h2>
  <table>
    <tr><td class="k">Escrow ID</td><td class="v mono">${esc(p.escrowId ?? '—')}</td></tr>
    <tr><td class="k">Fund transaction</td><td class="v mono">${esc(p.txHashFund ?? '—')}</td></tr>
    <tr><td class="k">Release transaction</td><td class="v mono">${esc(p.txHashRelease ?? '—')}</td></tr>
  </table>`;
  return shell(`Receipt ${p.id.slice(0, 8)}`, body);
}

export async function complianceReportHtml(paymentId: string): Promise<string> {
  const p = await loadPayment(paymentId);
  const d = p.decision;
  const rules: RuleResult[] = (d?.ruleResults as unknown as RuleResult[]) ?? [];
  const ruleRows = rules
    .map(
      (r) => `<div class="rule"><b>${esc(r.ruleId)}</b> · ${esc(r.jurisdiction)} · <span class="${r.passed ? 'pass' : 'fail'}">${r.passed ? 'PASS' : 'FAIL'}</span> (${esc(r.severity)})<br>
      <span style="color:#475264">${esc(r.legalRef)} — ${esc(r.message)}</span></div>`,
    )
    .join('');
  const body = `
  <div class="brand"><h1>Compliance Report</h1><span class="tag">GigBridge</span></div>
  <table>
    <tr><td class="k">Payment ID</td><td class="v mono">${esc(p.id)}</td></tr>
    <tr><td class="k">Corridor</td><td class="v">${esc(p.company.country)} → ${esc(p.freelancer.country)} (${esc(p.srcCurrency)}→${esc(p.dstCurrency)})</td></tr>
    <tr><td class="k">Amount</td><td class="v">${money(p.srcAmountMinor, p.srcCurrency)}</td></tr>
    <tr><td class="k">Verdict</td><td class="v"><span class="verdict v-${esc(d?.verdict ?? 'APPROVE')}">${esc(d?.verdict ?? '—')}</span></td></tr>
  </table>
  <h2>Agent reasoning</h2>
  <div class="agent">${esc(d?.agentExplanation ?? 'No decision recorded.')}</div>
  <h2>Rule results (${rules.length})</h2>
  ${ruleRows || '<p style="color:#8695a6">No rules recorded.</p>'}
  <h2>Tamper-evidence</h2>
  <table>
    <tr><td class="k">Decision anchored on-chain</td><td class="v mono">${esc(d?.anchorTxHash ?? '—')}</td></tr>
    ${d?.reviewedBy ? `<tr><td class="k">Reviewed by</td><td class="v mono">${esc(d.reviewedBy)}</td></tr><tr><td class="k">Review note</td><td class="v">${esc(d.reviewNote ?? '')}</td></tr>` : ''}
  </table>`;
  return shell(`Compliance ${p.id.slice(0, 8)}`, body);
}

// --- FIRC (Foreign Inward Remittance Certificate) -----------------------------
// The one document with real-world weight: an Indian resident's proof of a
// legitimate foreign-currency inward remittance, used for tax filing. Issued
// ONLY for a COMPLETED remittance credited in INR (see guards below).

// FIRC is only meaningful for funds actually credited in India.
export const FIRC_CURRENCY = 'INR';

// Deterministic, human-readable certificate number derived from the payment id
// (pure — unit-tested without a DB).
export function fircCertNumber(paymentId: string, issuedAt: Date): string {
  const serial = paymentId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `FIRC/${issuedAt.getUTCFullYear()}/${serial}`;
}

// "P0802 — Software services" (pure — unit-tested without a DB).
export function purposeDescription(code: string | null | undefined): string {
  if (!code) return 'Not specified';
  const label = PURPOSE_CODE_LABELS[code as PurposeCode];
  return label ? `${code} — ${label}` : code;
}

// VPA masking is one rule shared by the documents, the customer list and the payee
// picker, so it lives with the payout destination it describes. Re-exported here
// because the FIRC/receipt templates below (and their tests) read it from this module.
import { maskVpa } from '../payouts/destination.js';
export { maskVpa };

// One human-readable line describing how the INR reached the beneficiary: the
// off-ramp delivery method + the masked destination. Pure — tested.
export function payoutDeliveryLine(
  method: string | null | undefined,
  opts: { vpa?: string | null; accountMasked?: string | null } = {},
): string {
  if (method === 'UPI') return `UPI · ${maskVpa(opts.vpa) ?? '—'}`;
  return `Bank transfer${opts.accountMasked ? ` · ${opts.accountMasked}` : ''}`;
}

// A certificate may only attest to money that actually arrived. Pure — throws with
// the HTTP statusCode the global error handler maps; unit-tested without a DB.
export function assertFircEligible(state: PaymentState, dstCurrency: string): void {
  if (dstCurrency !== FIRC_CURRENCY) {
    throw Object.assign(
      new Error(`A FIRC is issued only for inward remittances credited in ${FIRC_CURRENCY} (this payment credits ${dstCurrency}).`),
      { statusCode: 400 },
    );
  }
  if (state !== 'COMPLETED') {
    throw Object.assign(
      new Error(`A FIRC can only be issued for a COMPLETED remittance (current state: ${state}).`),
      { statusCode: 409 },
    );
  }
}

export async function fircHtml(paymentId: string): Promise<string> {
  const p = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: {
      company: { include: { company: true } },
      freelancer: { include: { freelancer: true } },
      fxRate: true,
    },
  });

  assertFircEligible(p.state, p.dstCurrency);

  // The off-ramp account the INR actually landed in (UPI VPA or bank), for the
  // delivery line below. Best-effort: an older completed payment may predate the
  // payout-rail leg and simply show the stored method + reference.
  const acct = await prisma.payoutAccount.findFirst({
    where: { userId: p.freelancerId, currency: p.dstCurrency, active: true },
    orderBy: { createdAt: 'desc' },
  });

  const issuedAt = new Date();
  const certNo = fircCertNumber(p.id, issuedAt);
  const rate = p.fxRate ? (p.fxRate.lockedRate ?? p.fxRate.midRate) : null;
  const netForeignMinor = p.srcAmountMinor - (p.feeAmountMinor ?? 0);
  const beneficiary = p.freelancer.freelancer;
  const remitter = p.company.company;

  const body = `
  <div class="brand"><h1>Foreign Inward Remittance Certificate</h1><span class="tag">GigBridge · FIRC</span></div>
  <table>
    <tr><td class="k">Certificate No.</td><td class="v mono">${esc(certNo)}</td></tr>
    <tr><td class="k">Date of issue</td><td class="v">${esc(issuedAt.toISOString().slice(0, 10))}</td></tr>
    <tr><td class="k">Date of remittance</td><td class="v">${esc(p.createdAt.toISOString().slice(0, 10))}</td></tr>
    <tr><td class="k">Payment reference</td><td class="v mono">${esc(p.id)}</td></tr>
    ${p.invoiceRef ? `<tr><td class="k">Invoice reference</td><td class="v mono">${esc(p.invoiceRef)}</td></tr>` : ''}
  </table>

  <div class="stmt">This is to certify that the under-mentioned foreign inward remittance has been
  received and credited in Indian Rupees to the beneficiary named below, in accordance with
  the declared purpose. This certificate is generated from immutable on-chain settlement and
  ledger records.</div>

  <h2>Remitter (payer — abroad)</h2>
  <table>
    <tr><td class="k">Name</td><td class="v">${esc(remitter?.legalName ?? p.company.name)}</td></tr>
    <tr><td class="k">Country</td><td class="v">${esc(remitter?.country ?? p.company.country)}</td></tr>
    ${remitter?.regNumber ? `<tr><td class="k">Registration no.</td><td class="v mono">${esc(remitter.regNumber)}</td></tr>` : ''}
  </table>

  <h2>Beneficiary (payee — resident in India)</h2>
  <table>
    <tr><td class="k">Name</td><td class="v">${esc(beneficiary?.fullName ?? p.freelancer.name)}</td></tr>
    <tr><td class="k">Country of residence</td><td class="v">${esc(beneficiary?.country ?? p.freelancer.country)}</td></tr>
    <tr><td class="k">PAN / Tax ID</td><td class="v mono">${esc(beneficiary?.panOrTaxId ?? '—')}</td></tr>
  </table>

  <h2>Remittance details</h2>
  <table>
    <tr><td class="k">Purpose of remittance</td><td class="v">${esc(purposeDescription(p.purposeCode))}</td></tr>
    <tr><td class="k">Mode of payment</td><td class="v">Electronic — blockchain-settled (USDC escrow)</td></tr>
    <tr><td class="k">Gross amount received</td><td class="v">${money(p.srcAmountMinor, p.srcCurrency)}</td></tr>
    <tr><td class="k">Less: platform / AD charges</td><td class="v">${money(p.feeAmountMinor, p.srcCurrency)}</td></tr>
    <tr><td class="k">Net converted (foreign)</td><td class="v">${money(netForeignMinor, p.srcCurrency)}</td></tr>
    <tr><td class="k">Exchange rate applied (${esc(p.srcCurrency)}→${esc(p.dstCurrency)})</td><td class="v">${rate != null ? rate.toFixed(4) : '—'}</td></tr>
    <tr class="total"><td class="k">Amount credited to beneficiary</td><td class="v">${money(p.dstAmountMinor, p.dstCurrency)}</td></tr>
  </table>

  <h2>Settlement (on-chain)</h2>
  <table>
    <tr><td class="k">Escrow ID</td><td class="v mono">${esc(p.escrowId ?? '—')}</td></tr>
    <tr><td class="k">Fund transaction</td><td class="v mono">${esc(p.txHashFund ?? '—')}</td></tr>
    <tr><td class="k">Release transaction</td><td class="v mono">${esc(p.txHashRelease ?? '—')}</td></tr>
  </table>

  <h2>Payout to beneficiary (off-ramp)</h2>
  <table>
    <tr><td class="k">Delivery method</td><td class="v">${esc(payoutDeliveryLine(p.payoutMethod, { vpa: acct?.vpa, accountMasked: acct?.accountNumberMasked }))}</td></tr>
    <tr><td class="k">Off-ramp reference (UTR)</td><td class="v mono">${esc(p.payoutRailRef ?? '—')}</td></tr>
  </table>

  <div class="seal">
    <div class="sig">Authorised signatory<br><span class="mono" style="color:#8695a6">GigBridge Settlement</span></div>
    <div class="badge">Demo · not a bank-issued FIRC</div>
  </div>`;

  return shell(`FIRC ${p.id.slice(0, 8)}`, body);
}
