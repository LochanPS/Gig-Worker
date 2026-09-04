// Onboarding / verification (FR-1). A self-serve signup lands unverified and
// cannot be paid until identity is confirmed. Freelancers submit KYC, companies
// submit KYB; on success we provision a wallet + issue an on-chain-anchored
// credential so the EscrowVault verified-party gate passes.
import { useEffect, useState } from 'react';
import type { VerificationResult } from '@gigbridge/shared';
import { useAuth } from '../lib/auth.js';
import { api } from '../lib/api.js';
import { Chip } from '../components/bits.js';

export default function Verify() {
  const { user } = useAuth();
  const isCompany = user?.role === 'COMPANY';
  const [status, setStatus] = useState<VerificationResult | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // freelancer fields
  const [pan, setPan] = useState('');
  const [docType, setDocType] = useState('PAN');
  // company fields
  const [legalName, setLegalName] = useState(user?.name ?? '');
  const [regNumber, setRegNumber] = useState('');

  const load = () => api.verificationStatus().then(setStatus).catch((e) => setErr((e as Error).message));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      const r = isCompany
        ? await api.submitKyb({ legalName, regNumber, country: user?.country ?? 'DE' })
        : await api.submitKyc({ panOrTaxId: pan, documentType: docType, documentRef: `demo-${Date.now()}` });
      setStatus(r);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const verified = status?.status === 'VERIFIED';

  return (
    <>
      <h1 className="page">Verification</h1>
      <p className="sub">{isCompany ? 'Verify your business (KYB) to send payouts.' : 'Verify your identity (KYC) to receive payouts.'}</p>

      <div className="card" style={{ maxWidth: 520 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <span className="label">Status</span>
          <Chip value={status?.status ?? '—'} />
        </div>

        {verified ? (
          <>
            <div className="muted" style={{ fontSize: 13 }}>You're verified and can transact.</div>
            <div className="mono muted" style={{ fontSize: 11, marginTop: 10, wordBreak: 'break-all' }}>
              wallet: {status?.walletAddress ?? '—'}<br />
              credential: {status?.credentialHash ?? '—'}
            </div>
          </>
        ) : (
          <>
            {isCompany ? (
              <>
                <label>Legal name</label>
                <input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
                <div style={{ height: 10 }} />
                <label>Registration number</label>
                <input value={regNumber} onChange={(e) => setRegNumber(e.target.value)} placeholder="HRB-198234" />
              </>
            ) : (
              <>
                <label>PAN / Tax ID</label>
                <input value={pan} onChange={(e) => setPan(e.target.value)} placeholder="ABCDE1234F" />
                <div style={{ height: 10 }} />
                <label>Document type</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                  <option>PAN</option><option>PASSPORT</option><option>NATIONAL_ID</option>
                </select>
              </>
            )}
            <button className="btn" style={{ marginTop: 16 }} onClick={submit} disabled={busy}>
              {busy ? 'Verifying…' : `Submit ${isCompany ? 'KYB' : 'KYC'}`}
            </button>
            <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>Demo: any well-formed submission is auto-approved.</div>
          </>
        )}
        {err && <div className="err">{err}</div>}
      </div>
    </>
  );
}
