import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Payment } from '@gigbridge/shared';
import { api } from '../../lib/api.js';
import { useWs } from '../../lib/ws.js';
import { money, Chip, Stat } from '../../components/bits.js';
import Sparkline from '../../components/Sparkline.js';

const ATTENTION = ['FLAGGED', 'PAYOUT_FAILED', 'DISPUTED', 'RATE_LOCKED'];

export default function Overview() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [fx, setFx] = useState<number[]>([]);
  const nav = useNavigate();
  const load = () => api.payments().then(setPayments).catch(() => {});
  useEffect(() => {
    load();
    api.fxHistory('EURINR', 30).then((h) => setFx(h.map((d) => d.rate))).catch(() => {});
  }, []);
  useWs((e) => { if (e.type === 'payment.state') load(); });

  const paid = payments.filter((p) => p.state === 'COMPLETED');
  const totalPaidMinor = paid.reduce((s, p) => s + p.srcAmountMinor, 0);
  const feesSaved = Math.round(totalPaidMinor * 0.09 - totalPaidMinor * 0.0075) / 100;
  const attention = payments.filter((p) => ATTENTION.includes(p.state));

  // Corridor mix from live payments.
  const corridors = Object.entries(
    payments.reduce<Record<string, number>>((m, p) => { const k = `${p.srcCurrency}→${p.dstCurrency}`; m[k] = (m[k] ?? 0) + 1; return m; }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const maxC = Math.max(1, ...corridors.map(([, n]) => n));

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page">Overview</h1>
          <p className="sub">Every payout, direct to the freelancer — under 1% and under a minute.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link className="btn" to="/company/pay">New payout</Link>
          <Link className="btn ghost" to="/company/batch">Batch pay</Link>
          <Link className="btn ghost" to="/customers">Add customer</Link>
        </div>
      </div>

      <div className="grid stats" style={{ margin: '6px 0 22px' }}>
        <Stat label="Total paid (30d)" value={money(totalPaidMinor, 'EUR')} />
        <Stat label="Completed" value={String(paid.length)} ghost={`${payments.length} total`} />
        <div className={`card stat${attention.length ? ' hi' : ''}`}>
          <div className="label">Needs attention</div>
          <div className="val">{attention.length}</div>
          <div className="ghost">flagged · failed · disputed · to confirm</div>
        </div>
        <Stat label="Fees saved vs PayPal" value={`≈ EUR ${feesSaved.toLocaleString()}`} ghost="at 9% incumbent all-in" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 22, alignItems: 'stretch' }}>
        <div className="card">
          <div className="label" style={{ marginBottom: 6 }}>EUR → INR · last 30 days</div>
          <Sparkline data={fx} label="EUR to INR" />
        </div>
        <div className="card">
          <div className="label" style={{ marginBottom: 12 }}>Corridor mix</div>
          {corridors.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No payouts yet.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {corridors.map(([k, n]) => (
              <div key={k}>
                <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}><span className="mono">{k}</span><span className="muted">{n}</span></div>
                <div style={{ height: 7, background: 'var(--panel-2)', borderRadius: 999 }}><div style={{ height: 7, width: `${(n / maxC) * 100}%`, background: 'var(--accent)', borderRadius: 999 }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>Payouts</h2>
        <Link className="muted" to="/company/pay" style={{ fontSize: 13, fontWeight: 600 }}>New payout →</Link>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Payee</th><th>Amount</th><th>Corridor</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {payments.slice(0, 25).map((p) => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/company/payments/${p.id}`)}>
                <td>{p.freelancerName ?? <span className="mono">{p.freelancerId.slice(0, 8)}</span>}</td>
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
