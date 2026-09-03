// Payment detail with the live 7-step timeline + document downloads (UI_SPEC §3.3).
// Shared by company and freelancer views. Re-fetches on the matching WS event.
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Payment } from '@gigbridge/shared';
import { api, getToken } from '../lib/api.js';
import { useWs } from '../lib/ws.js';
import { money, Chip } from '../components/bits.js';
import Timeline from '../components/Timeline.js';

export default function PaymentDetail({ backTo }: { backTo: string }) {
  const { id = '' } = useParams();
  const [p, setP] = useState<Payment | null>(null);
  const load = () => api.payment(id).then(setP).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  useWs((e) => { if (e.type === 'payment.state' && e.paymentId === id) load(); });

  if (!p) return <div className="muted">Loading…</div>;
  const docUrl = (kind: 'receipt' | 'compliance') =>
    `/api/v1/payments/${p.id}/${kind}.pdf`; // opened with token via fetch below

  const openDoc = async (kind: 'receipt' | 'compliance') => {
    const res = await fetch(docUrl(kind), { headers: { authorization: `Bearer ${getToken()}` } });
    const html = await res.text();
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  return (
    <>
      <Link className="back" to={backTo}>← Back</Link>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page" style={{ margin: 0 }}>Payment</h1>
        <Chip value={p.state} />
      </div>
      <p className="sub mono">{p.id}</p>

      <div className="grid" style={{ gridTemplateColumns: '1.2fr 1fr', gap: 18, alignItems: 'start' }}>
        <div className="card">
          <h2 style={{ fontSize: 14, margin: '0 0 14px' }}>Lifecycle</h2>
          <Timeline timeline={p.timeline} />
        </div>
        <div className="card">
          <h2 style={{ fontSize: 14, margin: '0 0 12px' }}>Summary</h2>
          <div className="kv">
            <span className="k">Corridor</span><span className="v mono">{p.srcCurrency}→{p.dstCurrency}</span>
            <span className="k">Amount sent</span><span className="v">{money(p.srcAmountMinor, p.srcCurrency)}</span>
            <span className="k">Fee</span><span className="v">{money(p.feeAmountMinor, p.srcCurrency)}</span>
            <span className="k">Net received</span><span className="v">{money(p.dstAmountMinor, p.dstCurrency)}</span>
            <span className="k">Purpose</span><span className="v">{p.purposeCode ?? '—'}</span>
            <span className="k">Escrow</span><span className="v mono">{p.escrowId ? p.escrowId.slice(0, 16) + '…' : '—'}</span>
          </div>
          <div className="docbtns">
            <button className="btn ghost" onClick={() => openDoc('receipt')} disabled={p.state !== 'COMPLETED'}>Receipt</button>
            <button className="btn ghost" onClick={() => openDoc('compliance')}>Compliance report</button>
          </div>
        </div>
      </div>
    </>
  );
}
