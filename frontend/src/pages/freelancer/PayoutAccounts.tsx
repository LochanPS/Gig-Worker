// Payout methods — where the freelancer's money actually lands. A payout can't
// settle without an active account in the destination currency (else PAYOUT_FAILED).
// A method is either a BANK account or a UPI id (a VPA) — India's instant rail,
// the destination the USDC->INR off-ramp pushes to.
import { useEffect, useState } from 'react';
import type { PayoutAccount, Currency, PayoutMethod, AddPayoutAccountInput } from '@gigbridge/shared';
import { api } from '../../lib/api.js';

// name@psp — mirrors the shared VPA_REGEX so the UI validates before the request.
const VPA_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;

export default function PayoutAccounts() {
  const [list, setList] = useState<PayoutAccount[]>([]);
  const [method, setMethod] = useState<PayoutMethod>('UPI');
  const [label, setLabel] = useState('GPay');
  const [currency, setCurrency] = useState<Currency>('INR');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankIdentifier, setBankIdentifier] = useState('');
  const [vpa, setVpa] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.payoutAccounts().then(setList).catch((e) => setErr((e as Error).message));
  useEffect(() => { load(); }, []);

  const vpaValid = VPA_RE.test(vpa.trim());

  const add = async () => {
    setErr('');
    if (method === 'UPI' && !vpaValid) { setErr('Enter a valid UPI id (e.g. name@okhdfcbank).'); return; }
    setBusy(true);
    try {
      const body: AddPayoutAccountInput =
        method === 'UPI'
          ? { label, currency, method: 'UPI', vpa: vpa.trim() }
          : { label, currency, method: 'BANK', accountName, accountNumber, bankIdentifier };
      await api.addPayoutAccount(body);
      setAccountNumber(''); setAccountName(''); setBankIdentifier(''); setVpa('');
      await load();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    setErr('');
    try { await api.removePayoutAccount(id); await load(); }
    catch (e) { setErr((e as Error).message); }
  };

  const active = list.filter((a) => a.active);

  return (
    <>
      <h1 className="page">Payout methods</h1>
      <p className="sub">Where your payouts land. You need an active account in the payout currency to receive money.</p>

      {active.length === 0 && (
        <div className="card" style={{ borderLeft: '3px solid var(--reject)', marginBottom: 16 }}>
          <b>No active payout account.</b> <span className="muted">Any payout to you will fail until you add one below.</span>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16, maxWidth: 560 }}>
        {/* Method toggle: UPI (instant, a VPA) or a bank account. */}
        <label>Method</label>
        <div className="row" style={{ gap: 8 }}>
          <button className={`btn ${method === 'UPI' ? '' : 'ghost'}`} onClick={() => setMethod('UPI')} type="button">UPI</button>
          <button className={`btn ${method === 'BANK' ? '' : 'ghost'}`} onClick={() => setMethod('BANK')} type="button">Bank account</button>
        </div>
        <div style={{ height: 12 }} />

        <div className="row">
          <div style={{ flex: 2, minWidth: 160 }}><label>Label</label><input value={label} onChange={(e) => setLabel(e.target.value)} /></div>
          <div style={{ flex: 1, minWidth: 90 }}>
            <label>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {(['INR', 'EUR', 'USD'] as Currency[]).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ height: 10 }} />

        {method === 'UPI' ? (
          <>
            <label>UPI ID (VPA)</label>
            <input value={vpa} onChange={(e) => setVpa(e.target.value)} placeholder="name@okhdfcbank" autoCapitalize="none" spellCheck={false} />
            {vpa && !vpaValid && <div className="err" style={{ marginTop: 6 }}>UPI id must look like name@bank.</div>}
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Your rupees are pushed straight to this UPI id once a payment settles on-chain.
            </p>
          </>
        ) : (
          <>
            <label>Account holder name</label>
            <input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            <div style={{ height: 10 }} />
            <div className="row">
              <div style={{ flex: 1, minWidth: 140 }}><label>Account number</label><input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} /></div>
              <div style={{ flex: 1, minWidth: 140 }}><label>IFSC / IBAN / routing</label><input value={bankIdentifier} onChange={(e) => setBankIdentifier(e.target.value)} /></div>
            </div>
          </>
        )}

        <button className="btn" style={{ marginTop: 14 }} onClick={add} disabled={busy}>{busy ? 'Adding…' : 'Add payout account'}</button>
        {err && <div className="err">{err}</div>}
      </div>

      <h2 style={{ fontSize: 15 }}>Your accounts</h2>
      {list.length === 0 ? <div className="card muted">None yet.</div> : (
        <table className="table" style={{ width: '100%', fontSize: 13 }}>
          <thead><tr><th style={{ textAlign: 'left' }}>Label</th><th>Method</th><th>Currency</th><th>Destination</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} style={{ opacity: a.active ? 1 : 0.5 }}>
                <td>{a.label}</td>
                <td style={{ textAlign: 'center' }}>{a.method}</td>
                <td style={{ textAlign: 'center' }}>{a.currency}</td>
                <td className="mono">{a.method === 'UPI' ? a.vpa : `${a.accountNumberMasked ?? ''}${a.bankIdentifier ? ' · ' + a.bankIdentifier : ''}`}</td>
                <td style={{ textAlign: 'center' }}>{a.active ? 'active' : 'removed'}</td>
                <td>{a.active && <button className="btn ghost" onClick={() => remove(a.id)}>Remove</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
