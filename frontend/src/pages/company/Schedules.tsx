// Recurring payouts (retainers). Create a repeating payout, pause/resume it, and
// fire due schedules on demand. Own the workflow — retainers, not one-off transfers.
import { useEffect, useState } from 'react';
import type { PayoutSchedule, Cadence, Currency, PurposeCode } from '@gigbridge/shared';
import { api } from '../../lib/api.js';
import { money } from '../../components/bits.js';

const PAYEES = [
  { id: '33333333-3333-3333-3333-333333333333', name: 'Priya Sharma (IN)' },
  { id: '44444444-4444-4444-4444-444444444444', name: 'Alex Carter (US)' },
];
const CADENCES: Cadence[] = ['WEEKLY', 'BIWEEKLY', 'MONTHLY'];

export default function Schedules() {
  const [list, setList] = useState<PayoutSchedule[]>([]);
  const [payeeId, setPayeeId] = useState(PAYEES[0].id);
  const [amount, setAmount] = useState('2000');
  const [srcCurrency, setSrc] = useState<Currency>('EUR');
  const [cadence, setCadence] = useState<Cadence>('MONTHLY');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.schedules().then(setList).catch((e) => setErr((e as Error).message));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setErr(''); setMsg(''); setBusy(true);
    try {
      await api.createSchedule({
        payeeId, srcCurrency, dstCurrency: 'INR',
        srcAmountMinor: Math.round(parseFloat(amount || '0') * 100),
        purposeCode: 'P0802' as PurposeCode, cadence,
      });
      await load();
      setMsg('Schedule created — first run is due now. Use “Run due now” to fire it.');
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const toggle = async (s: PayoutSchedule) => {
    setErr('');
    try { s.active ? await api.pauseSchedule(s.id) : await api.resumeSchedule(s.id); await load(); }
    catch (e) { setErr((e as Error).message); }
  };

  const runDue = async () => {
    setErr(''); setMsg(''); setBusy(true);
    try {
      const r = await api.runDueSchedules();
      setMsg(r.ran === 0 ? 'Nothing due right now.' : `Fired ${r.ran} schedule(s): ${r.fired.map((f) => f.verdict).join(', ')}.`);
      await load();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <h1 className="page">Recurring payouts</h1>
      <p className="sub">Set a retainer once; every period it runs through compliance and settles automatically.</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 180 }}>
            <label>Payee</label>
            <select value={payeeId} onChange={(e) => setPayeeId(e.target.value)}>
              {PAYEES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 90 }}>
            <label>Currency</label>
            <select value={srcCurrency} onChange={(e) => setSrc(e.target.value as Currency)}>
              {(['EUR', 'USD', 'INR'] as Currency[]).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 100 }}>
            <label>Amount</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Cadence</label>
            <select value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
              {CADENCES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button className="btn" onClick={create} disabled={busy}>Add retainer</button>
        </div>
        {msg && <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>{msg}</div>}
        {err && <div className="err">{err}</div>}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Active schedules</h2>
        <button className="btn ghost" onClick={runDue} disabled={busy}>Run due now</button>
      </div>

      {list.length === 0 ? (
        <div className="card muted">No schedules yet.</div>
      ) : (
        <table className="table" style={{ width: '100%', fontSize: 13 }}>
          <thead><tr>
            <th style={{ textAlign: 'left' }}>Payee</th><th style={{ textAlign: 'right' }}>Amount</th>
            <th>Cadence</th><th>Next run</th><th>Runs</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td>{s.payeeName ?? s.payeeId.slice(0, 8)}</td>
                <td style={{ textAlign: 'right' }} className="mono">{money(s.srcAmountMinor, s.srcCurrency)}</td>
                <td style={{ textAlign: 'center' }}>{s.cadence}</td>
                <td className="mono" style={{ fontSize: 12 }}>{new Date(s.nextRunAt).toLocaleDateString()}</td>
                <td style={{ textAlign: 'center' }}>{s.runCount}</td>
                <td style={{ textAlign: 'center' }}>{s.active ? 'active' : 'paused'}</td>
                <td><button className="btn ghost" onClick={() => toggle(s)}>{s.active ? 'Pause' : 'Resume'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
