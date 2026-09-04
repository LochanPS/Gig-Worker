// The payout wizard (UI_SPEC §3.2) — the demo centrepiece. Four steps: pick the
// payee, set the amount and see a live quote, watch compliance decide, then
// confirm against a ticking rate lock. Everything here is the real backend.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Currency, EscrowMode, FreelancerSummary, FxQuote, Payment, PurposeCode } from '@gigbridge/shared';
import { PURPOSE_CODES } from '@gigbridge/shared';
import { api } from '../../lib/api.js';
import { money, Chip } from '../../components/bits.js';

// FEMA purpose codes the engine accepts, with what each actually means — the
// company has to pick one and "P0802" alone tells them nothing.
const PURPOSE_LABELS: Record<PurposeCode, string> = {
  P0802: 'Software services',
  P0801: 'IT consultancy',
  P1006: 'Design services',
  P0805: 'Data processing',
};

const STEPS = ['Payee', 'Amount', 'Compliance', 'Confirm'] as const;

// Countdown against the quote's own expiry — the rate lock is server-side truth,
// so this only visualises it and never decides validity itself.
function useCountdown(expiresAt: string | undefined): number {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return left;
}

function RateLockRing({ secondsLeft, total }: { secondsLeft: number; total: number }) {
  const frac = Math.max(0, Math.min(1, secondsLeft / total));
  const R = 26;
  const C = 2 * Math.PI * R;
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const tone = secondsLeft === 0 ? 'var(--reject)' : secondsLeft < 60 ? 'var(--flag)' : 'var(--approve)';
  return (
    <div className="ringwrap" title="Time left on this locked rate">
      <svg viewBox="0 0 64 64" className="ring">
        <circle cx="32" cy="32" r={R} fill="none" stroke="var(--line-strong)" strokeWidth="5" />
        <circle
          cx="32" cy="32" r={R} fill="none" stroke={tone} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 32 32)"
        />
      </svg>
      <div className="ringtext">{secondsLeft === 0 ? 'expired' : `${mm}:${ss}`}</div>
    </div>
  );
}

export default function NewPayout() {
  const [payees, setPayees] = useState<FreelancerSummary[]>([]);
  const [payeeId, setPayeeId] = useState('');
  const [search, setSearch] = useState('');
  const [step, setStep] = useState(0);

  const [amount, setAmount] = useState('500');
  const [srcCurrency, setSrcCurrency] = useState<Currency>('EUR');
  const [dstCurrency, setDstCurrency] = useState<Currency>('INR');
  const [purposeCode, setPurposeCode] = useState<PurposeCode>('P0802');
  const [escrowMode, setEscrowMode] = useState<EscrowMode>('INSTANT');

  const [quote, setQuote] = useState<FxQuote | null>(null);
  const [result, setResult] = useState<{ payment: Payment; quote: FxQuote; decision: { verdict: string; agentExplanation: string } } | null>(null);
  const [confirmed, setConfirmed] = useState<Payment | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Inline "add payee" so a company never has to leave the wizard to pay someone new.
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newCountry, setNewCountry] = useState('IN');

  const loadPayees = (select?: string) =>
    api.freelancers()
      .then((list) => {
        setPayees(list);
        // Preselect someone who can actually be paid, so the step opens ready to
        // continue rather than with a dead button and no hint why.
        setPayeeId((cur) => select ?? (cur || list.find((p) => p.payable)?.id || list[0]?.id || ''));
      })
      .catch((e) => setErr((e as Error).message));

  useEffect(() => { loadPayees(); }, []);

  const payee = payees.find((p) => p.id === payeeId);
  const amountMinor = Math.round(parseFloat(amount || '0') * 100);
  const secondsLeft = useCountdown(result?.quote.expiresAt ?? quote?.expiresAt);
  const lockExpired = !!(quote || result) && secondsLeft === 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payees;
    return payees.filter((p) => p.name.toLowerCase().includes(q) || p.country.toLowerCase().includes(q));
  }, [payees, search]);

  // Re-quote whenever the money terms change, so step 2 always shows live numbers.
  const quoteReq = useRef(0);
  useEffect(() => {
    if (step !== 1 || amountMinor <= 0) return;
    const mine = ++quoteReq.current;
    setErr('');
    api.quote(`${srcCurrency}${dstCurrency}`, amountMinor)
      .then((q) => { if (mine === quoteReq.current) setQuote(q); })
      .catch((e) => { if (mine === quoteReq.current) setErr((e as Error).message); });
  }, [step, amountMinor, srcCurrency, dstCurrency]);

  const addPayee = async () => {
    setErr(''); setBusy(true);
    try {
      const c = await api.createCustomer({
        role: 'FREELANCER', name: newName, email: newEmail, country: newCountry.toUpperCase(), verified: true,
      });
      await loadPayees(c.id);
      setAdding(false); setNewName(''); setNewEmail('');
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const runCompliance = async () => {
    setErr(''); setBusy(true); setResult(null); setConfirmed(null);
    try {
      const r = await api.createPayment({ payeeId, srcCurrency, dstCurrency, srcAmountMinor: amountMinor, purposeCode, escrowMode });
      setResult(r); setQuote(r.quote); setStep(2);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!result) return;
    setBusy(true); setErr('');
    try { setConfirmed(await api.confirmPayment(result.payment.id, result.quote.quoteId)); setStep(3); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const reset = () => {
    setResult(null); setConfirmed(null); setQuote(null); setErr(''); setStep(1);
  };

  return (
    <>
      <h1 className="page">New payout</h1>
      <p className="sub">Pick a payee and amount, watch compliance run, then settle.</p>

      <ol className="stepper">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'on' : i < step ? 'done' : ''}>
            <span className="dot">{i < step ? '✓' : i + 1}</span>{label}
          </li>
        ))}
      </ol>

      {err && <div className="err">{err}</div>}

      {/* ---------- 1. Payee ---------- */}
      {step === 0 && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label>Search payees</label>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or country" />
            </div>
            <button className="btn ghost" style={{ alignSelf: 'flex-end' }} onClick={() => setAdding((a) => !a)}>
              {adding ? 'Cancel' : '+ New payee'}
            </button>
          </div>

          {adding && (
            <div className="card" style={{ background: 'var(--panel-2)', marginBottom: 14 }}>
              <div className="row">
                <div style={{ flex: 2, minWidth: 160 }}><label>Full name</label><input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
                <div style={{ flex: 2, minWidth: 180 }}><label>Email</label><input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
                <div style={{ flex: 1, minWidth: 90 }}><label>Country</label><input value={newCountry} maxLength={2} onChange={(e) => setNewCountry(e.target.value)} /></div>
              </div>
              <button className="btn" style={{ marginTop: 12 }} disabled={busy || !newName || !newEmail} onClick={addPayee}>
                {busy ? 'Adding…' : 'Add and verify'}
              </button>
              <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
                Provisions a wallet and issues a credential, so they are payable immediately.
              </p>
            </div>
          )}

          <div className="payeelist">
            {filtered.map((p) => (
              <button key={p.id} className={`payee${p.id === payeeId ? ' on' : ''}`} onClick={() => setPayeeId(p.id)}>
                <div>
                  <b>{p.name}</b>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {p.country} · {p.payoutCurrencies.join(', ') || 'no payout account'}
                  </div>
                </div>
                <Chip value={p.kycStatus} />
              </button>
            ))}
            {filtered.length === 0 && <div className="muted" style={{ padding: 14 }}>No payees match.</div>}
          </div>

          {payee && !payee.payable && (
            <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
              {payee.kycStatus !== 'VERIFIED'
                ? 'Not verified — a payment to them will be refused.'
                : `No payout account yet — this payout will fail until they add one.`}
            </div>
          )}

          <button className="btn" style={{ marginTop: 14 }} disabled={!payeeId} onClick={() => setStep(1)}>Continue</button>
        </div>
      )}

      {/* ---------- 2. Amount + live quote ---------- */}
      {step === 1 && (
        <div className="card">
          <div className="row">
            <div style={{ flex: 1, minWidth: 130 }}>
              <label>Amount ({srcCurrency})</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            </div>
            <div style={{ flex: 1, minWidth: 110 }}>
              <label>From</label>
              <select value={srcCurrency} onChange={(e) => setSrcCurrency(e.target.value as Currency)}>
                {(['EUR', 'USD', 'INR'] as Currency[]).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 110 }}>
              <label>To</label>
              <select value={dstCurrency} onChange={(e) => setDstCurrency(e.target.value as Currency)}>
                {(['INR', 'USD', 'EUR'] as Currency[]).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 2, minWidth: 200 }}>
              <label>Purpose (FEMA code)</label>
              <select value={purposeCode} onChange={(e) => setPurposeCode(e.target.value as PurposeCode)}>
                {PURPOSE_CODES.map((c) => <option key={c} value={c}>{PURPOSE_LABELS[c]} ({c})</option>)}
              </select>
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <label>Escrow</label>
              <select value={escrowMode} onChange={(e) => setEscrowMode(e.target.value as EscrowMode)}>
                <option value="INSTANT">Pay now — settle straight through</option>
                <option value="HOLD">Fund escrow now — release when work is approved</option>
              </select>
            </div>
          </div>

          {quote && (
            <div className="card" style={{ marginTop: 14, background: 'var(--panel-2)' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div><div className="label">Mid rate</div><div className="mono">{quote.midRate.toFixed(4)}</div></div>
                <div><div className="label">Our fee (0.75%)</div><div className="mono">{money(quote.feeMinor, srcCurrency)}</div></div>
                <div><div className="label">{payee?.name ?? 'Payee'} receives</div><div className="mono"><b>{money(quote.payeeReceivesMinor, dstCurrency)}</b></div></div>
                <div>
                  <div className="label">Same payment on PayPal</div>
                  <div className="mono" style={{ color: 'var(--reject)' }}>−{money(quote.incumbentFeeMinor, srcCurrency)}</div>
                </div>
                <RateLockRing secondsLeft={secondsLeft} total={600} />
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                You keep {money(quote.incumbentFeeMinor - quote.feeMinor, srcCurrency)} that an incumbent would have taken.
              </div>
            </div>
          )}

          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn ghost" onClick={() => setStep(0)}>Back</button>
            <button className="btn" onClick={runCompliance} disabled={busy || !payeeId || amountMinor <= 0}>
              {busy ? 'Running…' : 'Run compliance'}
            </button>
          </div>
        </div>
      )}

      {/* ---------- 3. Compliance ---------- */}
      {step === 2 && result && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>Compliance decision</h2>
            <Chip value={result.decision.verdict} />
          </div>
          <div className="agent">{result.decision.agentExplanation}</div>

          <div className="row" style={{ marginTop: 16, alignItems: 'center' }}>
            <button className="btn ghost" onClick={reset}>Start over</button>
            {result.decision.verdict === 'REJECT' ? (
              <span className="muted" style={{ fontSize: 13 }}>Blocked — this payment cannot proceed.</span>
            ) : (
              <>
                <button className="btn" onClick={confirm} disabled={busy || lockExpired}>
                  {busy ? 'Settling…' : lockExpired ? 'Rate lock expired' : 'Confirm & settle'}
                </button>
                <RateLockRing secondsLeft={secondsLeft} total={600} />
              </>
            )}
          </div>
          {result.decision.verdict === 'FLAG' && (
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
              Flagged for review. You can still confirm; an operator sees the case either way.
            </p>
          )}
          {lockExpired && (
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
              The locked rate lapsed before you confirmed — start over for a fresh quote.
            </p>
          )}
        </div>
      )}

      {/* ---------- 4. Done ---------- */}
      {step === 3 && confirmed && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>
              {confirmed.state === 'COMPLETED' ? 'Paid' : confirmed.state === 'FUNDED' ? 'Held in escrow' : 'Submitted'}
            </h2>
            <Chip value={confirmed.state} />
          </div>
          <div className="kv">
            <span className="k">Payee receives</span><span className="v"><b>{money(confirmed.dstAmountMinor, confirmed.dstCurrency)}</b></span>
            <span className="k">Fee</span><span className="v">{money(confirmed.feeAmountMinor, confirmed.srcCurrency)}</span>
            <span className="k">Fund tx</span><span className="v mono" style={{ wordBreak: 'break-all' }}>{confirmed.txHashFund ?? '—'}</span>
            <span className="k">Release tx</span><span className="v mono" style={{ wordBreak: 'break-all' }}>{confirmed.txHashRelease ?? '—'}</span>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <Link className="btn" to={`/company/payments/${confirmed.id}`}>View timeline</Link>
            <button className="btn ghost" onClick={reset}>Pay someone else</button>
          </div>
        </div>
      )}
    </>
  );
}
