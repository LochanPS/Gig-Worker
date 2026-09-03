import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Payment } from '@gigbridge/shared';
import { api } from '../../lib/api.js';
import { useWs } from '../../lib/ws.js';
import { money, Chip, Stat } from '../../components/bits.js';

export default function Overview() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const load = () => api.payments().then(setPayments).catch(() => {});
  useEffect(() => { load(); }, []);
  useWs((e) => { if (e.type === 'payment.state') load(); });

  const paid = payments.filter((p) => p.state === 'COMPLETED');
  const totalPaidMinor = paid.reduce((s, p) => s + p.srcAmountMinor, 0);
  const feesSaved = Math.round(totalPaidMinor * 0.09 - totalPaidMinor * 0.0075) / 100;

  return (
    <>
      <h1 className="page">Overview</h1>
      <p className="sub">Every payout, direct to the freelancer — under 1% and under a minute.</p>

      <div className="grid stats" style={{ marginBottom: 22 }}>
        <Stat label="Total paid (30d)" value={money(totalPaidMinor, 'EUR')} />
        <Stat label="Completed" value={String(paid.length)} />
        <Stat label="Fees saved vs PayPal" value={`≈ EUR ${feesSaved.toLocaleString()}`} ghost="at 9% incumbent all-in" />
        <Stat label="Avg settlement" value="~47 sec" ghost="vs 3–5 days" />
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>Payouts</h2>
        <Link className="btn" to="/company/pay">New payout</Link>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Payee</th><th>Amount</th><th>Corridor</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {payments.slice(0, 25).map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.freelancerId.slice(0, 8)}</td>
                <td>{money(p.srcAmountMinor, p.srcCurrency)}</td>
                <td className="mono">{p.srcCurrency}→{p.dstCurrency}</td>
                <td><Chip value={p.state} /></td>
                <td className="muted">{p.createdAt.slice(0, 10)}</td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={5} className="muted">No payouts yet — create one.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
