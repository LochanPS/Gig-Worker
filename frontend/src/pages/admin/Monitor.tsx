import { useEffect, useState } from 'react';
import type { Alert, Dispute } from '@gigbridge/shared';
import { api } from '../../lib/api.js';
import { useWs } from '../../lib/ws.js';
import { Chip, Stat } from '../../components/bits.js';

interface QueueItem { paymentId: string; company: string; freelancer: string; verdict: string; agentExplanation: string; srcCurrency: string; srcAmountMinor: number; }

export default function Monitor() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const load = () => {
    api.queue().then((q) => setQueue(q as unknown as QueueItem[])).catch(() => {});
    api.alerts().then(setAlerts).catch(() => {});
    api.disputes().then(setDisputes).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  useWs((e) => { if (e.type === 'alert.new' || e.type === 'payment.state' || e.type === 'notification.new') load(); });

  const resolve = async (id: string, action: 'APPROVE' | 'REJECT') => {
    await api.resolveFlag(id, action, `${action} by operator`).catch(() => {});
    load();
  };

  const resolveDispute = async (id: string, action: 'REFUND' | 'DISMISS') => {
    await api.resolveDispute(id, action, `${action} by operator`).catch(() => {});
    load();
  };

  const openDisputes = disputes.filter((d) => d.status === 'OPEN');

  return (
    <>
      <h1 className="page">Operator monitor</h1>
      <p className="sub">Live compliance queue and fraud alerts across the platform.</p>

      <div className="grid stats" style={{ marginBottom: 22 }}>
        <Stat label="In review" value={String(queue.length)} />
        <Stat label="Open alerts" value={String(alerts.length)} />
        <Stat label="Open disputes" value={String(openDisputes.length)} />
        <Stat label="Corridors" value="3" ghost="EUR/USD ↔ INR" />
      </div>

      <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Disputes</h2>
      <div className="grid" style={{ marginBottom: 24 }}>
        {openDisputes.map((d) => (
          <div key={d.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>Payment <span className="mono">{d.paymentId.slice(0, 8)}…</span> · raised by {d.raisedByRole}</div>
              <Chip value="DISPUTED" />
            </div>
            <div className="agent" style={{ marginTop: 10 }}>{d.reason}</div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => resolveDispute(d.id, 'REFUND')}>Refund (reverse)</button>
              <button className="btn ghost" onClick={() => resolveDispute(d.id, 'DISMISS')}>Dismiss</button>
            </div>
          </div>
        ))}
        {openDisputes.length === 0 && <div className="card muted">No open disputes.</div>}
      </div>

      <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Compliance queue</h2>
      <div className="grid" style={{ marginBottom: 24 }}>
        {queue.map((q) => (
          <div key={q.paymentId} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div><b>{q.company}</b> → {q.freelancer} · <span className="mono">{q.srcCurrency} {(q.srcAmountMinor / 100).toFixed(2)}</span></div>
              <Chip value={q.verdict} />
            </div>
            <div className="agent" style={{ marginTop: 10 }}>{q.agentExplanation}</div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => resolve(q.paymentId, 'APPROVE')}>Approve</button>
              <button className="btn ghost" onClick={() => resolve(q.paymentId, 'REJECT')}>Reject</button>
            </div>
          </div>
        ))}
        {queue.length === 0 && <div className="card muted">Queue is clear.</div>}
      </div>

      <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Fraud alerts</h2>
      <div className="grid">
        {alerts.map((a) => (
          <div key={a.id} className="card row" style={{ justifyContent: 'space-between' }}>
            <div><Chip value={a.severity === 'HIGH' ? 'REJECTED' : 'FLAGGED'} /> <b style={{ marginLeft: 8 }}>{a.type}</b>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{JSON.stringify(a.details)}</div>
            </div>
            <span className="muted mono" style={{ fontSize: 11 }}>{a.createdAt.slice(0, 10)}</span>
          </div>
        ))}
        {alerts.length === 0 && <div className="card muted">No alerts.</div>}
      </div>
    </>
  );
}
