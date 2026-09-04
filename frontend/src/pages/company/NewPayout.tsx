// The payout wizard (UI_SPEC §3.2) — the demo centerpiece. Live quote, compliance
// verdict + agent reasoning, then confirm -> settle, all against the real backend.
import { useEffect, useState } from 'react';
import type { FreelancerSummary, FxQuote, Payment } from '@gigbridge/shared';
import { api } from '../../lib/api.js';
import { money, Chip } from '../../components/bits.js';

export default function NewPayout() {
  // The real roster (GET /directory/freelancers). This used to be three
  // hardcoded seed UUIDs, so anyone who actually signed up could never be paid.
  const [payees, setPayees] = useState<FreelancerSummary[]>([]);
  const [payeeId, setPayeeId] = useState('');
  const [amount, setAmount] = useState('500');
  const [quote, setQuote] = useState<FxQuote | null>(null);
  const [result, setResult] = useState<{ payment: Payment; quote: FxQuote; decision: { verdict: string; agentExplanation: string } } | null>(null);
  const [confirmed, setConfirmed] = useState<Payment | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.freelancers()
      .then((list) => {
        setPayees(list);
        setPayeeId((cur) => cur || list[0]?.id || '');
      })
      .catch((e) => setErr((e as Error).message));
  }, []);

  const payee = payees.find((p) => p.id === payeeId);
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
              {payees.length === 0 && <option value="">No freelancers yet</option>}
              {payees.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.country}, {p.kycStatus.toLowerCase()})
                </option>
              ))}
            </select>
            {payee && !payee.payable && (
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {payee.kycStatus !== 'VERIFIED'
                  ? 'Not verified yet — this payment will be refused.'
                  : 'No payout account on file — this payout will fail until they add one.'}
              </div>
            )}
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

      <button className="btn" onClick={runCompliance} disabled={busy || !payeeId}>{busy ? 'Running…' : 'Run compliance & create'}</button>
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
