import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Payment } from '@gigbridge/shared';
import { api } from '../../lib/api.js';
import { useWs } from '../../lib/ws.js';
import { money, Chip, Stat } from '../../components/bits.js';
import Sparkline from '../../components/Sparkline.js';

export default function Home() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const nav = useNavigate();
  const load = () => api.payments().then(setPayments).catch(() => {});
  useEffect(() => { load(); }, []);
  useWs((e) => { if (e.type === 'payment.state') load(); });

  const done = payments.filter((p) => p.state === 'COMPLETED');
  const balanceMinor = done.reduce((s, p) => s + (p.dstAmountMinor ?? 0), 0);

  return (
    <>
      <h1 className="page">My earnings</h1>
      <p className="sub">Paid directly, in full — you keep 99.25%.</p>

      <div className="grid stats" style={{ marginBottom: 22 }}>
        <Stat label="Balance (INR)" value={money(balanceMinor, 'INR')} />
        <Stat label="Payments received" value={String(done.length)} />
        <Stat label="You kept" value="99.25%" ghost="vs 90–92% on PayPal" />
      </div>

      {done.length > 1 && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="label" style={{ marginBottom: 6 }}>Earnings received (INR)</div>
          <Sparkline data={done.slice().reverse().map((p) => (p.dstAmountMinor ?? 0) / 100)} label="earnings" />
        </div>
      )}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>From</th><th>Gross</th><th>Net (INR)</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/me/payments/${p.id}`)}>
                <td className="mono">{p.companyId.slice(0, 8)}</td>
                <td>{money(p.srcAmountMinor, p.srcCurrency)}</td>
                <td>{money(p.dstAmountMinor, 'INR')}</td>
                <td><Chip value={p.state} /></td>
                <td className="muted">{p.createdAt.slice(0, 10)}</td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={5} className="muted">No payments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
