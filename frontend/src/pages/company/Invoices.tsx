// Company: inbox of freelancer invoices; approve -> creates & runs a payment.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Invoice } from '@gigbridge/shared';
import { api } from '../../lib/api.js';
import { money, Chip } from '../../components/bits.js';

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState('');
  const nav = useNavigate();
  const load = () => api.invoices().then(setInvoices).catch(() => {});
  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    setBusy(id);
    try {
      const r = await api.approveInvoice(id);
      nav(`/company/payments/${r.payment.id}`);
    } catch { load(); }
    finally { setBusy(''); }
  };

  return (
    <>
      <h1 className="page">Invoices inbox</h1>
      <p className="sub">Approve an invoice to pay the freelancer through the compliance pipeline.</p>

      <div className="grid">
        {invoices.map((i) => (
          <div key={i.id} className="card row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <b>{i.memo}</b> · {money(i.amountMinor, i.currency)}
              <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>from {i.freelancerId.slice(0, 8)} · {i.createdAt.slice(0, 10)}</div>
            </div>
            {i.status === 'SENT'
              ? <button className="btn" onClick={() => approve(i.id)} disabled={busy === i.id}>{busy === i.id ? 'Approving…' : 'Approve & pay'}</button>
              : <span><Chip value={i.status === 'PAID' ? 'COMPLETED' : 'RATE_LOCKED'} /> <span className="muted" style={{ fontSize: 12 }}>{i.status}</span></span>}
          </div>
        ))}
        {invoices.length === 0 && <div className="card muted">No invoices in your inbox.</div>}
      </div>
    </>
  );
}
