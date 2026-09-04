// Payment detail with the live 7-step timeline + document downloads (UI_SPEC §3.3).
// Shared by company and freelancer views. Re-fetches on the matching WS event.
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Payment, PaymentDocument } from '@gigbridge/shared';
import { api, getToken } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { useWs } from '../lib/ws.js';
import { money, Chip } from '../components/bits.js';
import Timeline from '../components/Timeline.js';

export default function PaymentDetail({ backTo }: { backTo: string }) {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [p, setP] = useState<Payment | null>(null);
  const [docs, setDocs] = useState<PaymentDocument[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const load = () => {
    api.payment(id).then(setP).catch(() => {});
    // The backend owns which documents exist and why one is not ready yet, so the
    // controls render straight from its descriptor instead of the UI guessing.
    api.paymentDocuments(id).then(setDocs).catch(() => setDocs([]));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  useWs((e) => { if (e.type === 'payment.state' && e.paymentId === id) load(); });

  const raiseDispute = async () => {
    setErr(''); setMsg(''); setBusy(true);
    try { await api.raiseDispute(id, reason || 'Work not delivered as agreed'); setReason(''); setMsg('Dispute opened — payment held pending review.'); await load(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const retryPayout = async () => {
    if (!p) return;
    setErr(''); setMsg(''); setBusy(true);
    try {
      const q = await api.quote(`${p.srcCurrency}${p.dstCurrency}`, p.srcAmountMinor);
      await api.retryPayout(id, q.quoteId);
      setMsg('Payout retried.'); await load();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const releaseEscrow = async () => {
    setErr(''); setMsg(''); setBusy(true);
    try { await api.releasePayment(id); setMsg('Work approved — escrow released to the payee.'); await load(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const refundEscrow = async () => {
    setErr(''); setMsg(''); setBusy(true);
    try { await api.refundPayment(id); setMsg('Escrow refunded to the payer.'); await load(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  if (!p) return <div className="muted">Loading…</div>;
  const isParty = user?.id === p.companyId || user?.id === p.freelancerId;
  const isCompany = user?.role === 'COMPANY';
  // Documents are auth'd, so fetch with the bearer token and hand the HTML to a
  // new window rather than linking straight at the URL.
  const openDoc = async (doc: PaymentDocument) => {
    const base = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
    const res = await fetch(base + doc.url, { headers: { authorization: `Bearer ${getToken()}` } });
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
            <span className="k">From</span><span className="v">{p.companyName ?? '—'}</span>
            <span className="k">To</span><span className="v">{p.freelancerName ?? '—'}</span>
            <span className="k">Corridor</span><span className="v mono">{p.srcCurrency}→{p.dstCurrency}</span>
            <span className="k">Amount sent</span><span className="v">{money(p.srcAmountMinor, p.srcCurrency)}</span>
            <span className="k">Fee</span><span className="v">{money(p.feeAmountMinor, p.srcCurrency)}</span>
            <span className="k">Net received</span><span className="v">{money(p.dstAmountMinor, p.dstCurrency)}</span>
            <span className="k">Purpose</span><span className="v">{p.purposeCode ?? '—'}</span>
            <span className="k">Escrow</span><span className="v mono">{p.escrowId ? p.escrowId.slice(0, 16) + '…' : '—'}</span>
            <span className="k">Escrow mode</span><span className="v">{p.escrowMode === 'HOLD' ? 'Held until work approved' : 'Straight through'}</span>
          </div>
          <div className="docbtns">
            {docs.map((d) => (
              <button
                key={d.kind}
                className="btn ghost"
                onClick={() => openDoc(d)}
                disabled={!d.available}
                title={d.available ? d.title : d.reason}
              >
                {d.title}
              </button>
            ))}
            {docs.length === 0 && <span className="muted" style={{ fontSize: 12 }}>No documents yet.</span>}
          </div>
        </div>
      </div>

      {/* Unhappy-path actions */}
      {p.state === 'PAYOUT_FAILED' && (
        <div className="card" style={{ marginTop: 18, borderLeft: '3px solid var(--reject)' }}>
          <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>Payout failed</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            The payee has no active {p.dstCurrency} payout account, so the money had nowhere to land.
            Once they add one, retry.
          </p>
          {isCompany && <button className="btn" onClick={retryPayout} disabled={busy}>{busy ? 'Retrying…' : 'Retry payout'}</button>}
        </div>
      )}

      {/* FR-2.2: a held escrow is funded but waiting on the company's approval. */}
      {p.state === 'FUNDED' && p.escrowMode === 'HOLD' && (
        <div className="card" style={{ marginTop: 18, borderLeft: '3px solid var(--flag, #d97706)' }}>
          <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>Escrow funded — awaiting work approval</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            The money is locked in escrow on-chain. Releasing it pays the freelancer; refunding
            returns it to you.
          </p>
          {isCompany && (
            <div className="row">
              <button className="btn" onClick={releaseEscrow} disabled={busy}>{busy ? 'Releasing…' : 'Approve work & release'}</button>
              <button className="btn ghost" onClick={refundEscrow} disabled={busy}>Refund</button>
            </div>
          )}
        </div>
      )}

      {/* A rate lock that lapsed before funding. The backend sweeps these to
          EXPIRED so a payment can never fund at a rate nobody agreed to. */}
      {p.state === 'EXPIRED' && (
        <div className="card" style={{ marginTop: 18, borderLeft: '3px solid var(--line-strong)' }}>
          <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>Rate lock expired</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            This payment was quoted at a rate that has since lapsed, so it was never funded —
            no money moved. Start a new payout to get a fresh quote at the current rate.
          </p>
          {isCompany && <Link className="btn" to="/company/pay">New payout</Link>}
        </div>
      )}

      {p.state === 'DISPUTED' && (
        <div className="card" style={{ marginTop: 18, borderLeft: '3px solid var(--flag, #d97706)' }}>
          <h2 style={{ fontSize: 14, margin: '0 0 6px' }}>Under dispute</h2>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>Funds are held pending admin review. Resolution reverses or restores the payment.</p>
        </div>
      )}

      {p.state === 'COMPLETED' && isParty && (
        <div className="card" style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 14, margin: '0 0 10px' }}>Raise a dispute</h2>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label>Reason</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. work not delivered" />
            </div>
            <button className="btn ghost" onClick={raiseDispute} disabled={busy}>Open dispute</button>
          </div>
        </div>
      )}

      {msg && <div className="muted" style={{ marginTop: 12 }}>{msg}</div>}
      {err && <div className="err">{err}</div>}
    </>
  );
}
