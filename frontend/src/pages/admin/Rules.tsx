// Rule registry (UI_SPEC 5.4 /admin/rules). The engine's rules are the product's
// accumulating asset — the operator should be able to see exactly what is being
// enforced per jurisdiction, and with what legal basis. GET /admin/rules has
// existed and had a client method since the first build; nothing rendered it.
import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Chip, Stat } from '../../components/bits.js';

interface Rule { id: string; jurisdiction: string; severity: string; legalRef: string }

// The engine tags rules by jurisdiction; group so the two-sided screening story
// (both countries, every payment) is visible at a glance.
const LABELS: Record<string, string> = {
  INDIA: 'India — RBI / FEMA',
  EU: 'European Union — AMLD / GDPR',
  US: 'United States — OFAC / FinCEN',
  PLATFORM: 'Platform — fraud & anomaly',
};

export default function Rules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => { api.rules().then(setRules).catch((e) => setErr((e as Error).message)); }, []);

  const groups = [...new Set(rules.map((r) => r.jurisdiction))];

  return (
    <>
      <h1 className="page">Rule registry</h1>
      <p className="sub">
        Every payment is screened against both jurisdictions. Rules are code, not prompts —
        the agent explains a decision, it never makes one.
      </p>
      {err && <div className="err">{err}</div>}

      <div className="grid stats" style={{ marginBottom: 22 }}>
        <Stat label="Active rules" value={String(rules.length)} />
        <Stat label="Jurisdictions" value={String(groups.length)} />
        <Stat label="Blocking" value={String(rules.filter((r) => r.severity === 'BLOCK').length)} ghost="reject outright" />
        <Stat label="Flagging" value={String(rules.filter((r) => r.severity === 'FLAG').length)} ghost="sent for review" />
      </div>

      {groups.map((g) => (
        <div key={g} style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>{LABELS[g] ?? g}</h2>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Rule</th><th>Severity</th><th>Legal basis</th></tr></thead>
              <tbody>
                {rules.filter((r) => r.jurisdiction === g).map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.id}</td>
                    <td><Chip value={r.severity === 'BLOCK' ? 'REJECT' : r.severity === 'FLAG' ? 'FLAG' : 'EXPIRED'} /></td>
                    <td className="muted">{r.legalRef}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {rules.length === 0 && !err && <div className="card muted">Loading…</div>}
    </>
  );
}
