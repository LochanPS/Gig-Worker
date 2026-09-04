// Freelancer: raise an invoice against a company + track its status.
import { useEffect, useState } from 'react';
import type { Invoice } from '@gigbridge/shared';
import { api } from '../../lib/api.js';
import { money, Chip } from '../../components/bits.js';

// Seeded companies (BUILD_CONTRACTS §7).
const COMPANIES = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Novatek GmbH' },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Chennai Softworks' },
];

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companyId, setCompanyId] = useState(COMPANIES[0].id);
  const [amount, setAmount] = useState('800');
  const [memo, setMemo] = useState('Landing page build');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = () => api.invoices().then(setInvoices).catch(() => {});
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await api.createInvoice({ companyId, amountMinor: Math.round(parseFloat(amount || '0') * 100), currency: 'EUR', memo });
      setMemo(''); load();
    } catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <h1 className="page">Invoices</h1>
      <p className="sub">Raise a payment request; the company approves and you're paid through Corridor.</p>

      <form className="card" style={{ marginBottom: 20 }} onSubmit={submit}>
        <div className="row">
          <div style={{ flex: 2, minWidth: 200 }}>
            <label>Company</label>
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {COMPANIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 110 }}>
            <label>Amount (EUR)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </div>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label>Memo</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
          <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send invoice'}</button>
        </div>
        {err && <div className="err">{err}</div>}
      </form>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Memo</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id}>
                <td>{i.memo}</td>
                <td>{money(i.amountMinor, i.currency)}</td>
                <td><Chip value={i.status === 'PAID' ? 'COMPLETED' : i.status === 'APPROVED' ? 'RATE_LOCKED' : 'COMPLIANCE_CHECK'} /> <span className="muted" style={{ fontSize: 12 }}>{i.status}</span></td>
                <td className="muted">{i.createdAt.slice(0, 10)}</td>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={4} className="muted">No invoices yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
