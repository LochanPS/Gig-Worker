import { useEffect, useState } from 'react';
import type { Alert, Dispute, AdminMetrics, CustomerSummary, AdjudicationSummary } from '@gigbridge/shared';
import { api } from '../../lib/api.js';
import { useWs } from '../../lib/ws.js';
import { money, Chip, Stat } from '../../components/bits.js';
import { SettlementBadge } from '../../components/chainbits.js';
import { useSystemInfo } from '../../lib/system.js';

interface QueueItem { paymentId: string; company: string; freelancer: string; verdict: string; agentExplanation: string; srcCurrency: string; srcAmountMinor: number; }

export default function Monitor() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [adj, setAdj] = useState<AdjudicationSummary | null>(null);
  const [sweep, setSweep] = useState('');
  const [sweeping, setSweeping] = useState(false);
  const system = useSystemInfo();
  const load = () => {
    api.queue().then((q) => setQueue(q as unknown as QueueItem[])).catch(() => {});
    api.alerts().then(setAlerts).catch(() => {});
    api.disputes().then(setDisputes).catch(() => {});
    api.metrics().then(setMetrics).catch(() => {});
    api.customers().then(setCustomers).catch(() => {});
    api.adjudications().then(setAdj).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  useWs((e) => {
    // The server pushes metrics every few seconds; take them straight off the
    // wire rather than re-polling every endpoint on a timer.
    if (e.type === 'metrics.tick') setMetrics(e.metrics);
    else if (e.type === 'alert.new' || e.type === 'payment.state' || e.type === 'notification.new') load();
  });

  const resolve = async (id: string, action: 'APPROVE' | 'REJECT') => { await api.resolveFlag(id, action, `${action} by operator`).catch(() => {}); load(); };
  const resolveDispute = async (id: string, action: 'REFUND' | 'DISMISS') => { await api.resolveDispute(id, action, `${action} by operator`).catch(() => {}); load(); };

  // Sweep rate locks past their window. This already ran on a backend timer and
  // was exposed as an endpoint, with nothing in the UI able to call it — so the
  // EXPIRED state could only be reached by waiting out the clock.
  const expireLocks = async () => {
    setSweeping(true); setSweep('');
    try {
      const r = await api.expireLocks();
      setSweep(r.expired === 0 ? 'No rate locks were past their window.' : `Expired ${r.expired} stale rate lock(s).`);
      load();
    } catch (e) { setSweep((e as Error).message); }
    finally { setSweeping(false); }
  };

  const openDisputes = disputes.filter((d) => d.status === 'OPEN');
  const verified = customers.filter((c) => c.verified).length;

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page" style={{ margin: 0 }}>Operator monitor</h1>
        <SettlementBadge />
      </div>
      <p className="sub">The AI adjudicator clears the routine flow — you handle only what it escalates.</p>

      {/* Settlement + chain. An operator could not previously tell whether the
          platform was writing real transactions or simulating them — and the
          backend falls back to simulated on any chain error, silently. */}
      <div className="card" style={{ marginBottom: 16, borderLeft: `3px solid ${system?.degraded ? 'var(--reject)' : system?.settlementMode === 'real' ? 'var(--approve)' : 'var(--line-strong)'}` }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="label">Settlement</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              {!system ? 'Checking…'
                : system.degraded
                  ? <>Real settlement is configured, but the chain was <b>unreachable at boot</b> — payments are being simulated and transaction hashes are not real.</>
                  : system.settlementMode === 'real'
                    ? <>Writing <b>real transactions</b> on {system.chainName}. Every hash links to the explorer.</>
                    : <>Simulated: the full payment lifecycle runs, but no transaction reaches a chain.</>}
            </div>
            {system?.explorerUrl && (
              <a className="muted mono" style={{ fontSize: 12 }} href={system.explorerUrl} target="_blank" rel="noreferrer">{system.explorerUrl} ↗</a>
            )}
          </div>
          <div style={{ minWidth: 200 }}>
            <div className="label">Chain</div>
            <div className="mono" style={{ fontSize: 13, marginTop: 4 }}>{system ? `${system.chainName} · ${system.chainId}` : '—'}</div>
            {system?.contracts && (
              <div style={{ marginTop: 8 }}>
                {Object.entries(system.contracts).map(([name, addr]) => (
                  <div key={name} className="mono" style={{ fontSize: 11, opacity: 0.75 }}>
                    {name}{' '}
                    {system.explorerUrl
                      ? <a href={`${system.explorerUrl}/address/${addr}`} target="_blank" rel="noreferrer">{addr.slice(0, 10)}…{addr.slice(-4)}</a>
                      : `${addr.slice(0, 10)}…${addr.slice(-4)}`}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ minWidth: 190 }}>
            <div className="label">Maintenance</div>
            <button className="btn ghost" style={{ marginTop: 6 }} onClick={expireLocks} disabled={sweeping}>
              {sweeping ? 'Sweeping…' : 'Expire stale rate locks'}
            </button>
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              {sweep || 'Runs the sweep that moves un-funded, lapsed quotes to EXPIRED.'}
            </div>
          </div>
        </div>
      </div>

      {/* Platform metrics */}
      <div className="grid stats" style={{ marginBottom: 16 }}>
        <Stat label="Volume (24h)" value={money(metrics?.volume24hMinorUsd ?? 0, 'USD')} ghost="across corridors" />
        <Stat label="Fee revenue" value={money(metrics?.revenueMinorUsd ?? 0, 'USD')} ghost="at 0.75%" />
        <Stat label="Avg settlement" value={metrics ? `~${metrics.avgSettlementSeconds} sec` : '—'} ghost="vs 3–5 days" />
        <Stat label="Flagged" value={metrics ? `${metrics.flaggedPct}%` : '—'} ghost="of payments" />
      </div>

      {/* AI adjudication summary — the human sees only escalations */}
      <div className="card hi" style={{ marginBottom: 22, display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'center' }}>
        <div><div className="label">AI adjudication</div><div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>Auto-clears / auto-rejects confident flags · escalates the rest</div></div>
        <div className="spacer" style={{ flex: 1 }} />
        <div><div className="label">Auto-cleared</div><div className="val" style={{ fontSize: 24 }}>{adj?.autoCleared ?? 0}</div></div>
        <div><div className="label">Auto-rejected</div><div className="val" style={{ fontSize: 24 }}>{adj?.autoRejected ?? 0}</div></div>
        <div><div className="label">Handled without you</div><div className="val" style={{ fontSize: 24 }}>{adj ? `${adj.autoHandledPct}%` : '—'}</div></div>
        <div><div className="label">Escalated to you</div><div className="val" style={{ fontSize: 24 }}>{queue.length}</div></div>
        <div><div className="label">Open disputes</div><div className="val" style={{ fontSize: 24 }}>{openDisputes.length}</div></div>
        <div><div className="label">Open alerts</div><div className="val" style={{ fontSize: 24 }}>{alerts.length}</div></div>
        <div><div className="label">Verified customers</div><div className="val" style={{ fontSize: 24 }}>{verified}</div></div>
      </div>

      <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Needs your review — AI escalations</h2>
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
        {queue.length === 0 && <div className="card muted">Nothing escalated — the AI adjudicator cleared everything.</div>}
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

      <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Fraud alerts</h2>
      <div className="grid">
        {alerts.map((a) => (
          <div key={a.id} className="card row" style={{ justifyContent: 'space-between' }}>
            <div><Chip value={a.severity === 'HIGH' ? 'REJECTED' : 'FLAGGED'} /> <b style={{ marginLeft: 8 }}>{a.type}</b>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{alertText(a.details)}</div>
              {typeof a.details?.ruleId === 'string' && (
                <div className="mono muted" style={{ fontSize: 11, marginTop: 3 }}>
                  {String(a.details.ruleId)}{typeof a.details.jurisdiction === 'string' ? ` · ${a.details.jurisdiction}` : ''}
                </div>
              )}
            </div>
            <span className="muted mono" style={{ fontSize: 11 }}>{a.createdAt.slice(0, 10)}</span>
          </div>
        ))}
        {alerts.length === 0 && <div className="card muted">No alerts.</div>}
      </div>

      <h2 style={{ fontSize: 15, margin: '22px 0 10px' }}>Recent adjudications</h2>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Payment</th><th>Decision</th><th>Confidence</th><th>Rationale</th><th>By</th></tr></thead>
          <tbody>
            {(adj?.recent ?? []).map((r) => (
              <tr key={`${r.paymentId}-${r.at}`}>
                <td className="mono">{r.paymentId.slice(0, 8)}…</td>
                <td><Chip value={r.action === 'AUTO_CLEAR' ? 'APPROVE' : r.action === 'AUTO_REJECT' ? 'REJECT' : 'FLAG'} /></td>
                <td className="mono">{r.confidence == null ? '—' : `${Math.round(r.confidence * 100)}%`}</td>
                <td className="muted" style={{ maxWidth: 420 }}>{r.rationale ?? '—'}</td>
                <td className="muted mono" style={{ fontSize: 11 }}>{r.by ?? '—'}</td>
              </tr>
            ))}
            {adj && adj.recent.length === 0 && (
              <tr><td colSpan={5} className="muted">Nothing adjudicated yet — flags appear here as the agent triages them.</td></tr>
            )}
            {!adj && <tr><td colSpan={5} className="muted">Loading…</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Alerts carry {ruleId, jurisdiction, message} from the rule that raised them.
// Fall back to a compact rendering if a future alert shape differs.
function alertText(details: unknown): string {
  if (details && typeof details === 'object' && 'message' in details) {
    const m = (details as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return typeof details === 'string' ? details : JSON.stringify(details);
}
