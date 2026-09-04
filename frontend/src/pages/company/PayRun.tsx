// Batch pay-run (FR-2.5) — pay N freelancers in one action. Add line items, run
// one compliance sweep, review per-payee verdicts, then confirm the approved ones
// together. This is the wedge: startups paying 5–50 freelancers/month.
import { useState } from 'react';
import type { PayRun, PurposeCode, Currency } from '@gigbridge/shared';
import { api } from '../../lib/api.js';
import { money, Chip } from '../../components/bits.js';

const PAYEES = [
  { id: '33333333-3333-3333-3333-333333333333', name: 'Priya Sharma (IN, verified)' },
  { id: '44444444-4444-4444-4444-444444444444', name: 'Alex Carter (US, verified)' },
  { id: '66666666-6666-6666-6666-666666666666', name: 'SanctionedCo (watchlist — will reject)' },
];

interface Row { payeeId: string; amount: string; srcCurrency: Currency; purposeCode: PurposeCode }
const blankRow = (): Row => ({ payeeId: PAYEES[0].id, amount: '500', srcCurrency: 'EUR', purposeCode: 'P0802' });

export default function PayRunPage() {
  const [rows, setRows] = useState<Row[]>([blankRow(), { ...blankRow(), payeeId: PAYEES[1].id, srcCurrency: 'USD', amount: '1200' }]);
  const [note, setNote] = useState('Monthly contractor run');
  const [run, setRun] = useState<PayRun | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, blankRow()]);
  const delRow = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  const total = rows.reduce((s, r) => s + Math.round(parseFloat(r.amount || '0') * 100), 0);

  const create = async () => {
    setErr(''); setBusy(true); setRun(null);
    try {
      const payRun = await api.createPayRun({
        note,
        items: rows.map((r) => ({
          payeeId: r.payeeId,
          srcCurrency: r.srcCurrency,
          dstCurrency: 'INR',
          srcAmountMinor: Math.round(parseFloat(r.amount || '0') * 100),
          purposeCode: r.purposeCode,
        })),
      });
      setRun(payRun);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!run) return;
    setBusy(true); setErr('');
    try { setRun(await api.confirmPayRun(run.id)); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const nameOf = (id: string) => PAYEES.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  return (
    <>
      <h1 className="page">Batch pay-run</h1>
      <p className="sub">Pay a whole roster in one action. One compliance sweep, one confirm, N escrows.</p>

      {!run && (
        <div className="card" style={{ marginBottom: 16 }}>
          {rows.map((r, i) => (
            <div className="row" key={i} style={{ alignItems: 'flex-end', marginBottom: 10 }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label>Payee</label>
                <select value={r.payeeId} onChange={(e) => setRow(i, { payeeId: e.target.value })}>
                  {PAYEES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 90 }}>
                <label>Currency</label>
                <select value={r.srcCurrency} onChange={(e) => setRow(i, { srcCurrency: e.target.value as Currency })}>
                  {(['EUR', 'USD', 'INR'] as Currency[]).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 100 }}>
                <label>Amount</label>
                <input value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} inputMode="decimal" />
              </div>
              <button className="btn ghost" onClick={() => delRow(i)} disabled={rows.length === 1}>✕</button>
            </div>
          ))}
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
            <button className="btn ghost" onClick={addRow}>+ Add payee</button>
            <div className="muted mono">{rows.length} payees · total ≈ {money(total, 'mixed')}</div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label>Run note</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button className="btn" style={{ marginTop: 14 }} onClick={create} disabled={busy}>
            {busy ? 'Running compliance…' : `Run compliance on ${rows.length} payees`}
          </button>
        </div>
      )}

      {err && <div className="err">{err}</div>}

      {run && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>Pay-run review</h2>
            <Chip value={run.status} />
          </div>
          <div className="row" style={{ gap: 18, marginBottom: 14 }}>
            <div><div className="label">Approved</div><div className="val" style={{ color: 'var(--approve, #16a34a)' }}>{run.approvedCount}</div></div>
            <div><div className="label">Flagged</div><div className="val">{run.flaggedCount}</div></div>
            <div><div className="label">Rejected</div><div className="val" style={{ color: 'var(--reject)' }}>{run.rejectedCount}</div></div>
            <div><div className="label">Payees</div><div className="val">{run.itemCount}</div></div>
          </div>

          <table className="table" style={{ width: '100%', fontSize: 13 }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Payee</th><th style={{ textAlign: 'right' }}>Amount</th><th>State</th><th>Tx (fund)</th></tr></thead>
            <tbody>
              {(run.payments ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{nameOf(p.freelancerId)}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{money(p.srcAmountMinor, p.srcCurrency)}</td>
                  <td style={{ textAlign: 'center' }}><Chip value={p.state} /></td>
                  <td className="mono muted" style={{ fontSize: 11 }}>{p.txHashFund ? p.txHashFund.slice(0, 14) + '…' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="row" style={{ marginTop: 16, gap: 10 }}>
            {(run.status === 'REVIEWED' || run.status === 'PARTIAL') && run.approvedCount > 0 && (
              <button className="btn" onClick={confirm} disabled={busy}>
                {busy ? 'Settling…' : `Confirm & settle ${run.approvedCount} approved`}
              </button>
            )}
            <button className="btn ghost" onClick={() => setRun(null)}>New run</button>
          </div>
        </div>
      )}
    </>
  );
}
