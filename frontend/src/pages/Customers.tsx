// Customers — create and manage the real parties (companies + freelancers).
// Admin sees everyone and can create either; a company sees its payable
// freelancers and can add new ones. Created + verified freelancers show up
// immediately in the New-payout picker (same directory).
//
// Creation used to capture a name, an email and a country, and then invent a
// random settlement wallet that nobody held the keys to — so a "real" payout went
// to an address that did not exist, and the payee had no payout destination at
// all, which meant the first payment to them died in PAYOUT_FAILED. Both are now
// part of the form: the wallet the money settles to, and the UPI id or bank
// account it is off-ramped into.
import { useEffect, useState } from 'react';
import type { CustomerSummary, Currency, PayoutMethod } from '@gigbridge/shared';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { Chip } from '../components/bits.js';
import { SettlementBadge, WalletAddress, DestinationTag } from '../components/chainbits.js';
import { useSystemInfo } from '../lib/system.js';

type PartyRole = 'COMPANY' | 'FREELANCER';

// Mirror the shared regexes so the form can say what is wrong before the request.
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const KEY_RE = /^0x[0-9a-fA-F]{64}$/;
const VPA_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;

export default function Customers() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const system = useSystemInfo();
  const [list, setList] = useState<CustomerSummary[]>([]);
  const [role, setRole] = useState<PartyRole>('FREELANCER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('IN');
  const [pan, setPan] = useState('');
  const [verified, setVerified] = useState(true);

  // --- settlement wallet ---
  const [walletAddress, setWalletAddress] = useState('');
  const [walletKey, setWalletKey] = useState('');
  const [showWallet, setShowWallet] = useState(false);

  // --- payout destination (the off-ramp last mile) ---
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod | ''>('UPI');
  const [payoutCurrency, setPayoutCurrency] = useState<Currency>('INR');
  const [vpa, setVpa] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankIdentifier, setBankIdentifier] = useState('');

  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.customers().then(setList).catch((e) => setErr((e as Error).message));
  useEffect(() => { load(); }, []);

  // A company has no off-ramp destination — it pays, it is not paid.
  const wantsPayout = role === 'FREELANCER' && payoutMethod !== '';
  const addrValid = !walletAddress || ADDR_RE.test(walletAddress.trim());
  const keyValid = !walletKey || KEY_RE.test(walletKey.trim());
  const vpaValid = !wantsPayout || payoutMethod !== 'UPI' || VPA_RE.test(vpa.trim());
  const bankValid = !wantsPayout || payoutMethod !== 'BANK' || !!(accountName && accountNumber.length >= 4 && bankIdentifier);
  const canSubmit = !!name && !!email && addrValid && keyValid && vpaValid && bankValid;

  const create = async () => {
    setErr(''); setMsg(''); setBusy(true);
    try {
      const c = await api.createCustomer({
        role, name, email, country, verified,
        panOrTaxId: pan || undefined,
        legalName: role === 'COMPANY' ? name : undefined,
        // Omit rather than send empty strings: the backend generates a wallet when
        // neither is given, and validates the pair when they are.
        walletAddress: walletAddress.trim() || undefined,
        walletKey: walletKey.trim() || undefined,
        ...(wantsPayout
          ? {
              payoutMethod: payoutMethod as PayoutMethod,
              payoutCurrency,
              ...(payoutMethod === 'UPI'
                ? { vpa: vpa.trim() }
                : { accountName, accountNumber, bankIdentifier }),
            }
          : {}),
      });
      const how = c.walletSource === 'PROVIDED' ? 'using the wallet you supplied' : 'with a generated demo wallet';
      const lands = c.payoutDestination
        ? ` Payouts land on ${c.payoutDestination.method === 'UPI' ? 'UPI' : 'bank'} ${c.payoutDestination.masked}.`
        : role === 'FREELANCER'
          ? ' No payout destination yet — a payment to them will settle on-chain and then fail with nowhere to land.'
          : '';
      setMsg(`Created ${c.name} (${c.role.toLowerCase()}) ${how}${c.verified ? ', verified and ready to transact' : ''}.${lands}`);
      setName(''); setEmail(''); setPan('');
      setWalletAddress(''); setWalletKey('');
      setVpa(''); setAccountName(''); setAccountNumber(''); setBankIdentifier('');
      await load();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const verify = async (id: string) => {
    setErr('');
    try { await api.verifyCustomer(id); await load(); }
    catch (e) { setErr((e as Error).message); }
  };

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page" style={{ margin: 0 }}>Customers</h1>
        <SettlementBadge />
      </div>
      <p className="sub">{isAdmin ? 'Every company and freelancer on the platform.' : 'Freelancers you can pay — add a new one and they appear in New payout.'}</p>

      <div className="card" style={{ marginBottom: 18, maxWidth: 820 }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          {isAdmin && (
            <div style={{ flex: 1, minWidth: 130 }}>
              <label>Type</label>
              <select value={role} onChange={(e) => setRole(e.target.value as PartyRole)}>
                <option value="FREELANCER">Freelancer</option>
                <option value="COMPANY">Company</option>
              </select>
            </div>
          )}
          <div style={{ flex: 2, minWidth: 160 }}><label>{role === 'COMPANY' ? 'Company name' : 'Full name'}</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div style={{ flex: 2, minWidth: 180 }}><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></div>
          <div style={{ flex: 1, minWidth: 80 }}><label>Country</label><input value={country} maxLength={2} onChange={(e) => setCountry(e.target.value.toUpperCase())} /></div>
        </div>
        <div className="row" style={{ alignItems: 'flex-end', marginTop: 10 }}>
          {role === 'FREELANCER' && <div style={{ flex: 2, minWidth: 160 }}><label>PAN / Tax ID (optional)</label><input value={pan} onChange={(e) => setPan(e.target.value)} /></div>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, flex: 1 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={verified} onChange={(e) => setVerified(e.target.checked)} />
            Verify now (issue credential)
          </label>
        </div>

        {/* ---------- Settlement wallet ---------- */}
        {/* Which EVM account the escrow releases to. Supplying one means the money
            moves to an account you control and can watch on the explorer; leaving
            it blank generates a throwaway, which is honest for a demo but is not a
            real destination. */}
        <div className="card" style={{ background: 'var(--panel-2)', marginTop: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ fontSize: 13 }}>Settlement wallet</b>
            <button className="btn ghost" type="button" onClick={() => setShowWallet((v) => !v)}>
              {showWallet ? 'Use a generated wallet' : 'Use my own wallet'}
            </button>
          </div>
          {!showWallet ? (
            <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
              A demo wallet will be generated for them. Fine for a walkthrough — but the address is
              a throwaway nobody controls, so nothing is verifiable on an explorer.
            </p>
          ) : (
            <>
              <div className="row" style={{ marginTop: 10 }}>
                <div style={{ flex: 3, minWidth: 260 }}>
                  <label>Wallet address</label>
                  <input value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder="0x…" spellCheck={false} autoCapitalize="none" />
                  {!addrValid && <div className="err" style={{ marginTop: 6 }}>An address is 0x followed by 40 hex characters.</div>}
                </div>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <div style={{ flex: 3, minWidth: 260 }}>
                  <label>Private key {role === 'COMPANY' ? '(required to pay from this account)' : '(optional)'}</label>
                  <input type="password" value={walletKey} onChange={(e) => setWalletKey(e.target.value)} placeholder="0x…" spellCheck={false} autoCapitalize="none" />
                  {!keyValid && <div className="err" style={{ marginTop: 6 }}>A private key is 0x followed by 64 hex characters.</div>}
                </div>
              </div>
              <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
                The address is derived from the key when you give one, so the two can never disagree.
                An address on its own is <b>receive-only</b>: that party can be paid, but cannot fund a
                payment. <b>Test accounts only</b> — the key is stored on the server so the agent can
                settle without a wallet prompt. Never paste a key that holds real value.
              </p>
            </>
          )}
        </div>

        {/* ---------- Payout destination: the last mile ---------- */}
        {/* Where the money goes AFTER the on-chain release. Without this the payee
            has no off-ramp and the first payment to them lands in PAYOUT_FAILED —
            previously only the payee themself could fix that, from their own login. */}
        {role === 'FREELANCER' && (
          <div className="card" style={{ background: 'var(--panel-2)', marginTop: 12 }}>
            <b style={{ fontSize: 13 }}>Payout destination</b>
            <p className="muted" style={{ fontSize: 12, margin: '4px 0 10px' }}>
              Where their rupees land once the payment settles on-chain. Without one, a payout to
              them fails with nowhere to deliver.
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button className={`btn ${payoutMethod === 'UPI' ? '' : 'ghost'}`} type="button" onClick={() => setPayoutMethod('UPI')}>UPI</button>
              <button className={`btn ${payoutMethod === 'BANK' ? '' : 'ghost'}`} type="button" onClick={() => setPayoutMethod('BANK')}>Bank account</button>
              <button className={`btn ${payoutMethod === '' ? '' : 'ghost'}`} type="button" onClick={() => setPayoutMethod('')}>They will add it</button>
            </div>

            {wantsPayout && (
              <>
                <div className="row" style={{ marginTop: 10 }}>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <label>Currency</label>
                    <select value={payoutCurrency} onChange={(e) => setPayoutCurrency(e.target.value as Currency)}>
                      {(['INR', 'EUR', 'USD'] as Currency[]).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {payoutMethod === 'UPI' ? (
                    <div style={{ flex: 3, minWidth: 200 }}>
                      <label>UPI ID (VPA)</label>
                      <input value={vpa} onChange={(e) => setVpa(e.target.value)} placeholder="name@okhdfcbank" spellCheck={false} autoCapitalize="none" />
                      {vpa && !vpaValid && <div className="err" style={{ marginTop: 6 }}>UPI id must look like name@bank.</div>}
                    </div>
                  ) : (
                    <div style={{ flex: 3, minWidth: 200 }}><label>Account holder name</label><input value={accountName} onChange={(e) => setAccountName(e.target.value)} /></div>
                  )}
                </div>
                {payoutMethod === 'BANK' && (
                  <div className="row" style={{ marginTop: 10 }}>
                    <div style={{ flex: 1, minWidth: 140 }}><label>Account number</label><input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} /></div>
                    <div style={{ flex: 1, minWidth: 140 }}><label>IFSC / IBAN / routing</label><input value={bankIdentifier} onChange={(e) => setBankIdentifier(e.target.value)} /></div>
                  </div>
                )}
                {payoutMethod === 'UPI' && (
                  <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
                    A UPI destination is what makes the off-ramp return a scannable
                    upi:// intent on the payment page once the money lands.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <button className="btn" style={{ marginTop: 14 }} onClick={create} disabled={busy || !canSubmit}>
          {busy ? 'Creating…' : 'Add customer'}
        </button>
        {msg && <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>{msg}</div>}
        {err && <div className="err">{err}</div>}
      </div>

      <table className="table" style={{ width: '100%', fontSize: 13.5 }}>
        <thead><tr>
          <th style={{ textAlign: 'left' }}>Name</th>
          <th style={{ textAlign: 'left' }}>Email</th>
          <th>Type</th>
          <th style={{ textAlign: 'left' }}>Settlement wallet</th>
          <th style={{ textAlign: 'left' }}>Payout destination</th>
          <th>Payments</th>
          <th>Status</th>
          <th></th>
        </tr></thead>
        <tbody>
          {list.map((c) => (
            <tr key={c.id}>
              <td><b>{c.name}</b><div className="muted" style={{ fontSize: 11 }}>{c.country}</div></td>
              <td className="mono" style={{ fontSize: 12 }}>{c.email}</td>
              <td style={{ textAlign: 'center' }}>{c.role}</td>
              <td><WalletAddress address={c.walletAddress} source={c.walletSource} canSign={c.canSign} /></td>
              <td>{c.role === 'FREELANCER' ? <DestinationTag destination={c.payoutDestination} /> : <span className="muted" style={{ fontSize: 12 }}>—</span>}</td>
              <td style={{ textAlign: 'center' }}>{c.paymentsCount ?? 0}</td>
              <td style={{ textAlign: 'center' }}><Chip value={c.status} /></td>
              <td>{!c.verified && isAdmin && c.role !== 'ADMIN' && <button className="btn ghost" onClick={() => verify(c.id)}>Verify</button>}</td>
            </tr>
          ))}
          {list.length === 0 && <tr><td colSpan={8} className="muted">No customers yet — add one above.</td></tr>}
        </tbody>
      </table>

      {system && (
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          {system.settlementMode === 'real'
            ? `Settling on ${system.chainName}. Wallet addresses link to the block explorer.`
            : system.degraded
              ? 'Real settlement is configured but the chain was unreachable, so payments are being simulated — wallet addresses hold no on-chain balance right now.'
              : 'Settlement is simulated: the payment lifecycle is real, but no transaction reaches a chain.'}
        </p>
      )}
    </>
  );
}
