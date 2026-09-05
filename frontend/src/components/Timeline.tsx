// The 7-step payment lifecycle timeline (UI_SPEC §3.3). Steps present in the
// payment's timeline[] are "done"; the rest render as pending.
import type { TimelineStep } from '@gigbridge/shared';
import { explorerTx } from '../lib/chain.js';

const STEPS = [
  { key: 'CREATED', label: 'Payment created' },
  { key: 'COMPLIANCE_APPROVED', label: 'Compliance approved' },
  { key: 'RATE_LOCKED', label: 'FX rate locked' },
  { key: 'FUNDED', label: 'Escrow funded on-chain' },
  { key: 'SETTLING', label: 'Settling' },
  { key: 'RELEASED', label: 'Released to payee' },
  { key: 'CREDITED', label: 'Payee credited' },
];

export default function Timeline({ timeline }: { timeline: TimelineStep[] }) {
  const byKey = new Map(timeline.map((t) => [t.key, t]));
  return (
    <div className="timeline">
      {STEPS.map((s, i) => {
        const done = byKey.get(s.key);
        return (
          <div key={s.key} className={`tl-step ${done ? 'done' : 'pending'}`}>
            <div className="tl-rail">
              <span className="tl-dot" />
              {i < STEPS.length - 1 && <span className="tl-line" />}
            </div>
            <div className="tl-body">
              <div className="tl-label">{s.label}</div>
              {done ? (
                <div className="tl-meta">
                  <span className="muted">{done.at ? new Date(done.at).toLocaleTimeString() : ''}{done.actor ? ` · ${done.actor}` : ''}</span>
                  {done.txHash && (() => {
                    const url = explorerTx(done.txHash);
                    return url
                      ? <a className="mono txlink" href={url} target="_blank" rel="noopener noreferrer" title={done.txHash}>{done.txHash.slice(0, 18)}… ↗</a>
                      : <span className="mono txlink" title={done.txHash}>{done.txHash.slice(0, 18)}…</span>;
                  })()}
                </div>
              ) : <div className="tl-meta muted">Pending</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
