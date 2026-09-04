// Earnings history (UI_SPEC 5.3 /me/history): every payment with the rate that
// applied, the fee taken and the share kept — the transparency claim, per row.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Payment } from '@gigbridge/shared';
import { api } from '../../lib/api.js';
import { useWs } from '../../lib/ws.js';
import { money, Chip } from '../../components/bits.js';

// Effective rate actually applied to this payment, derived from the amounts on
// the row rather than a separate lookup: net destination over net source.
function effectiveRate(p: Payment): string {
  const net = p.srcAmountMinor - (p.feeAmountMinor ?? 0);
  if (!p.dstAmountMinor || net <= 0) return '—';
  return (p.dstAmountMinor / net).toFixed(4);
}

function keptPct(p: Payment): string {
  if (!p.feeAmountMinor || p.srcAmountMinor <= 0) return '—';
  return `${(100 - (p.feeAmountMinor / p.srcAmountMinor) * 100).toFixed(2)}%`;
}

export default function History() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const nav = useNavigate();
  const load = () => api.payments().then(setPayments).catch(() => {});
  useEffect(() => { load(); }, []);
  useWs((e) => { if (e.type === 'payment.state') load(); });

  const settled = payments.filter((p) => p.feeAmountMinor != null);
  const totalFee = settled.reduce((s, p) => s + (p.feeAmountMinor ?? 0), 0);
  const totalGross = settled.reduce((s, p) => s + p.srcAmountMinor, 0);

  return (
    <>
      <h1 className="page">Earnings history</h1>
      <p className="sub">
        {settled.length > 0
          ? `Across ${settled.length} settled payment${settled.length === 1 ? '' : 's'} you kept ${(100 - (totalFee / totalGross) * 100).toFixed(2)}% of the gross.`
          : 'Every payment, with the rate and fee that applied.'}
      </p>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>From</th><th>Gross</th><th>Fee</th><th>Rate</th><th>Net received</th><th>You kept</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/me/payments/${p.id}`)}>
                <td className="muted">{p.createdAt.slice(0, 10)}</td>
                <td>{p.companyName ?? <span className="mono">{p.companyId.slice(0, 8)}</span>}</td>
                <td>{money(p.srcAmountMinor, p.srcCurrency)}</td>
                <td className="muted">{money(p.feeAmountMinor, p.srcCurrency)}</td>
                <td className="mono">{effectiveRate(p)}</td>
                <td>{money(p.dstAmountMinor, p.dstCurrency)}</td>
                <td className="mono">{keptPct(p)}</td>
                <td><Chip value={p.state} /></td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={8} className="muted">No payments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
