// Batch pay-run (FR-2.5) — pay N freelancers in one action. Add line items, run
// one compliance sweep, review per-payee verdicts, then confirm the approved ones
// together. This is the wedge: startups paying 5–50 freelancers/month.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FreelancerSummary, PayRun, PurposeCode, Currency } from '@gigbridge/shared';
import { api } from '../../lib/api.js';
import { money, Chip } from '../../components/bits.js';
import { SettlementBadge, TxHash, DestinationTag } from '../../components/chainbits.js';

interface Row { payeeId: string; amount: string; srcCurrency: Currency; purposeCode: PurposeCode }

export default function PayRunPage() {
  // The payee list used to be three hardcoded seed UUIDs, so a freelancer created
  // through the app could never appear in a batch run — and the run broke entirely
  // against any database that had not been seeded. It is the real roster now.
  const [payees, setPayees] = useState<FreelancerSummary[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState('Monthly contractor run');
  const [run, setRun] = useState<PayRun | null>(null);
  // Past runs: GET /payruns has always existed, with nothing in the UI reading it,
  // so a completed batch vanished the moment the page was left.
  const [history, setHistory] = useState<PayRun[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const loadHistory = () => api.payRuns().then(setHistory).catch(() => {});

  useEffect(() => {
    api.freelancers()
      .then((list) => {
        setPayees(list);
        // Open with one line per payable freelancer (capped), so the page is usable
        // immediately without asking the operator to build a roster by hand.
        const seed = list.filter((p) => p.payable).slice(0, 2);
        setRows(
          (seed.length ? seed : list.slice(0, 1)).map((p, i) => ({
            payeeId: p.id,
            amount: i === 0 ? '500' : '1200',
            srcCurrency: i === 0 ? 'EUR' : 'USD',
            purposeCode: 'P0802' as PurposeCode,
          })),
        );
      })
      .catch((e) => setErr((e as Error).message));
    loadHistory();
  }, []);

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const blankRow = (): Row => ({
    payeeId: payees.find((p) => p.payable)?.id ?? payees[0]?.id ?? '',
    amount: '500',
    srcCurrency: 'EUR',
    purposeCode: 'P0802',
  });
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
      await loadHistory();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!run) return;
    setBusy(true); setErr('');
    try { setRun(await api.confirmPayRun(run.id)); await loadHistory(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const byId = useMemo(() => new Map(payees.map((p) => [p.id, p])), [payees]);
  const nameOf = (id: string) => byId.get(id)?.name ?? id.slice(0, 8);

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page" style={{ margin: 0 }}>Batch pay-run</h1>
        <SettlementBadge />
      </div>
      <p className="sub">Pay a whole roster in one action. One compliance sweep, one confirm, N escrows.</p>

      {payees.length === 0 && !err && (
        <div className="card muted" style={{ marginBottom: 16 }}>
          No freelancers on the roster yet — <Link to="/customers">add one</Link> and they appear here.
        </div>
      )}

      {!run && (
        <div className="card" style={{ marginBottom: 16 }}>
          {rows.map((r, i) => (
            <div className="row" key={i} style={{ alignItems: 'flex-end', marginBottom: 10 }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label>Payee</label>
                <select value={r.payeeId} onChange={(e) => setRow(i, { payeeId: e.target.value })}>
                  {payees.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.country}{p.payable ? '' : ' — not payable'})
                    </option>
                  ))}
                </select>
                {/* Where this line's money would land, before the run is committed. */}
                <div style={{ marginTop: 4 }}><DestinationTag destination={byId.get(r.payeeId)?.payoutDestination} /></div>
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
                  <td style={{ fontSize: 11 }}><TxHash hash={p.txHashFund} short /></td>
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

      {/* Past runs. The backend has always served these; nothing read them, so a
          confirmed batch disappeared as soon as you navigated away. */}
      {history.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, margin: '24px 0 10px' }}>Previous runs</h2>
          <table className="table" style={{ width: '100%', fontSize: 13 }}>
            <thead><tr>
              <th style={{ textAlign: 'left' }}>Note</th><th>Payees</th><th>Approved</th><th>Flagged</th><th>Rejected</th><th>Status</th><th style={{ textAlign: 'left' }}>Created</th><th></th>
            </tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} style={{ opacity: run?.id === h.id ? 1 : 0.92 }}>
                  <td>{h.note || <span className="muted">untitled run</span>}</td>
                  <td style={{ textAlign: 'center' }}>{h.itemCount}</td>
                  <td style={{ textAlign: 'center' }}>{h.approvedCount}</td>
                  <td style={{ textAlign: 'center' }}>{h.flaggedCount}</td>
                  <td style={{ textAlign: 'center' }}>{h.rejectedCount}</td>
                  <td style={{ textAlign: 'center' }}><Chip value={h.status} /></td>
                  <td className="muted" style={{ fontSize: 12 }}>{h.createdAt.slice(0, 16).replace('T', ' ')}</td>
                  <td>
                    <button className="btn ghost" onClick={() => api.payRun(h.id).then(setRun).catch((e) => setErr((e as Error).message))}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
