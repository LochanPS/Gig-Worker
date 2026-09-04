// Treasury (UI_SPEC 5.4 /admin/treasury): what the platform is holding in escrow
// right now, per corridor, and what it has earned. Escrow held is money that is
// funded on-chain but not yet released or refunded — the operator's exposure.
import { useEffect, useState } from 'react';
import type { Treasury as TreasuryData } from '@gigbridge/shared';
import { api } from '../../lib/api.js';
import { useWs } from '../../lib/ws.js';
import { money, Stat } from '../../components/bits.js';

export default function Treasury() {
  const [t, setT] = useState<TreasuryData | null>(null);
  const [err, setErr] = useState('');
  const load = () => api.treasury().then(setT).catch((e) => setErr((e as Error).message));
  useEffect(() => { load(); }, []);
  // Escrow moves whenever a payment funds or settles.
  useWs((e) => { if (e.type === 'payment.state') load(); });

  return (
    <>
      <h1 className="page">Treasury</h1>
      <p className="sub">Value held in escrow per corridor, and fee revenue booked on settled payments.</p>
      {err && <div className="err">{err}</div>}

      <div className="grid stats" style={{ marginBottom: 22 }}>
        <Stat label="Held in escrow" value={money(t?.totalHeldMinorUsd ?? 0, 'USD')} ghost={`${t?.inEscrowCount ?? 0} payment(s) mid-flight`} />
        <Stat label="Fee revenue" value={money(t?.feeRevenueMinorUsd ?? 0, 'USD')} ghost={`over ${t?.completedCount ?? 0} settled`} />
        <Stat label="Active corridors" value={String(t?.corridors.length ?? 0)} />
        <Stat
          label="Effective take"
          value={
            t && t.feeRevenueMinorUsd > 0 && t.completedCount > 0
              ? money(Math.round(t.feeRevenueMinorUsd / t.completedCount), 'USD')
              : '—'
          }
          ghost="average fee per payment"
        />
      </div>

      <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>Escrow by corridor</h2>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Corridor</th><th>Payments</th><th>Held (source)</th><th>Held (USD)</th></tr></thead>
          <tbody>
            {(t?.corridors ?? []).map((c) => (
              <tr key={c.corridor}>
                <td className="mono">{c.corridor.slice(0, 3)}→{c.corridor.slice(3)}</td>
                <td>{c.count}</td>
                <td>{money(c.heldMinor, c.srcCurrency)}</td>
                <td className="mono">{money(c.heldMinorUsd, 'USD')}</td>
              </tr>
            ))}
            {t && t.corridors.length === 0 && (
              <tr><td colSpan={4} className="muted">Nothing in escrow — every funded payment has settled out.</td></tr>
            )}
            {!t && !err && <tr><td colSpan={4} className="muted">Loading…</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
