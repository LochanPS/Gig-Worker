// Document service (step 10). Generates print-ready HTML for a payment receipt and
// a compliance report. The browser turns these into PDF via print-to-PDF, so there
// is no heavy PDF dependency (roadmap: PDFs are lowest priority, keep it demo-safe).
import { prisma } from '../../lib/db.js';
import type { RuleResult } from '@gigbridge/shared';

const money = (minor: number | null | undefined, ccy: string) =>
  minor == null ? '—' : `${ccy} ${(minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const shell = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8">
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
