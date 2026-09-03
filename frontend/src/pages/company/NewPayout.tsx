// The payout wizard (UI_SPEC §3.2) — the demo centerpiece. Live quote, compliance
// verdict + agent reasoning, then confirm -> settle, all against the real backend.
import { useState } from 'react';
import type { FxQuote, Payment } from '@gigbridge/shared';
import { api } from '../../lib/api.js';
import { money, Chip } from '../../components/bits.js';

// Seeded demo freelancers (BUILD_CONTRACTS §7).
const PAYEES = [
  { id: '33333333-3333-3333-3333-333333333333', name: 'Priya Sharma (IN, verified)' },
  { id: '44444444-4444-4444-4444-444444444444', name: 'Alex Carter (US, verified)' },
  { id: '66666666-6666-6666-6666-666666666666', name: 'SanctionedCo (watchlist — will reject)' },
];

export default function NewPayout() {
  const [payeeId, setPayeeId] = useState(PAYEES[0].id);
  const [amount, setAmount] = useState('500');
  const [quote, setQuote] = useState<FxQuote | null>(null);
  const [result, setResult] = useState<{ payment: Payment; quote: FxQuote; decision: { verdict: string; agentExplanation: string } } | null>(null);
  const [confirmed, setConfirmed] = useState<Payment | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const amountMinor = Math.round(parseFloat(amount || '0') * 100);

  const getQuote = async () => {
    setErr(''); setQuote(null);
    try { setQuote(await api.quote('EURINR', amountMinor)); }
    catch (e) { setErr((e as Error).message); }
  };

  const runCompliance = async () => {
    setErr(''); setBusy(true); setResult(null); setConfirmed(null);
    try {
      const r = await api.createPayment({ payeeId, srcCurrency: 'EUR', dstCurrency: 'INR', srcAmountMinor: amountMinor, purposeCode: 'P0802' });
      setResult(r); setQuote(r.quote);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!result) return;
    setBusy(true); setErr('');
    try { setConfirmed(await api.confirmPayment(result.payment.id, result.quote.quoteId)); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <h1 className="page">New payout</h1>
      <p className="sub">Pick a payee and amount, watch compliance run, then settle.</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <div style={{ flex: 2, minWidth: 220 }}>
            <label>Payee</label>
            <select value={payeeId} onChange={(e) => setPayeeId(e.target.value)}>
              {PAYEES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Amount (EUR)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} onBlur={getQuote} inputMode="decimal" />
          </div>
          <button className="btn ghost" onClick={getQuote}>Quote</button>
        </div>

        {quote && (
          <div className="card" style={{ marginTop: 14, background: 'var(--panel-2)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div><div className="label">Mid rate</div><div className="mono">{quote.midRate.toFixed(4)}</div></div>
              <div><div className="label">Fee (0.75%)</div><div className="mono">{money(quote.feeMinor, 'EUR')}</div></div>
              <div><div className="label">Payee receives</div><div className="mono">{money(quote.payeeReceivesMinor, 'INR')}</div></div>
              <div><div className="label">vs PayPal (9%)</div><div className="mono" style={{ color: 'var(--reject)' }}>{money(quote.incumbentFeeMinor, 'EUR')}</div></div>
            </div>
          </div>
        )}
      </div>

      <button className="btn" onClick={runCompliance} disabled={busy}>{busy ? 'Running…' : 'Run compliance & create'}</button>
      {err && <div className="err">{err}</div>}

      {result && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>Compliance decision</h2>
            <Chip value={result.decision.verdict} />
          </div>
          <div className="agent">{result.decision.agentExplanation}</div>
          {result.decision.verdict !== 'REJECT' && !confirmed && (
            <button className="btn" style={{ marginTop: 14 }} onClick={confirm} disabled={busy}>
              {busy ? 'Settling…' : 'Confirm & settle'}
            </button>
          )}
          {confirmed && (
            <div style={{ marginTop: 14 }}>
              <Chip value={confirmed.state} />
              <div className="mono muted" style={{ fontSize: 12, marginTop: 8 }}>
                fund: {confirmed.txHashFund?.slice(0, 22)}…<br />release: {confirmed.txHashRelease?.slice(0, 22)}…
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
