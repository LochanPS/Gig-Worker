// Identity & credential (UI_SPEC 5.3 /me/identity). The backend has issued an
// on-chain-anchored verifiable credential at verification since the identity
// module landed, and exposed it at /credentials/me — with no UI reading it. This
// is the "verify once, reuse forever" claim made visible to the freelancer.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Credential, VerificationResult } from '@gigbridge/shared';
import { api, getToken } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.js';
import { Chip } from '../../components/bits.js';

// Mirrors the backend's credentialStatus(): revoked wins, then expiry.
function statusOf(c: Credential): 'ACTIVE' | 'EXPIRED' | 'REVOKED' {
  if (c.revoked) return 'REVOKED';
  return new Date(c.expiresAt).getTime() <= Date.now() ? 'EXPIRED' : 'ACTIVE';
}

const day = (iso: string) => iso.slice(0, 10);

export default function Identity() {
  const { user } = useAuth();
  const [cred, setCred] = useState<Credential | null>(null);
  const [status, setStatus] = useState<VerificationResult | null>(null);
  const [noCred, setNoCred] = useState(false);

  useEffect(() => {
    api.verificationStatus().then(setStatus).catch(() => {});
    // 404 here is the normal "not verified yet" case, not an error to surface.
    api.myCredential().then(setCred).catch(() => setNoCred(true));
  }, []);

  const openCertificate = async () => {
    if (!cred) return;
    const base = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
    const res = await fetch(`${base}/api/v1/credentials/${cred.id}/credential.pdf`, {
      headers: { authorization: `Bearer ${getToken()}` },
    });
    const html = await res.text();
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  return (
    <>
      <h1 className="page">Identity</h1>
      <p className="sub">Verified once, reused on every payment — no re-checks per payout.</p>

      <div className="grid" style={{ gridTemplateColumns: '1.15fr 1fr', gap: 18, alignItems: 'start' }}>
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 14, margin: 0 }}>Verifiable credential</h2>
            {cred && <Chip value={statusOf(cred)} />}
          </div>

          {cred ? (
            <>
              <div className="kv">
                <span className="k">Decentralised identifier</span><span className="v mono">{cred.did}</span>
                <span className="k">Credential hash</span><span className="v mono" style={{ wordBreak: 'break-all' }}>{cred.hash}</span>
                <span className="k">Issued</span><span className="v">{day(cred.issuedAt)}</span>
                <span className="k">Expires</span><span className="v">{day(cred.expiresAt)}</span>
                <span className="k">On-chain anchor</span>
                <span className="v mono" style={{ wordBreak: 'break-all' }}>{cred.anchorTxHash ?? '—'}</span>
              </div>
              <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 14 }}>
                Only the hash is mirrored on-chain via the IdentityRegistry — no personal data
                leaves the platform. The settlement layer reads that same registry to gate payouts.
              </p>
              <button className="btn ghost" style={{ marginTop: 6 }} onClick={openCertificate}>
                Credential certificate
              </button>
            </>
          ) : noCred ? (
            <>
              <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
                No credential yet — it is issued the moment your identity check passes.
              </p>
              <Link className="btn" to="/verify">Complete verification</Link>
            </>
          ) : (
            <div className="muted">Loading…</div>
          )}
        </div>

        <div className="card">
          <h2 style={{ fontSize: 14, margin: '0 0 14px' }}>Account</h2>
          <div className="kv">
            <span className="k">Name</span><span className="v">{user?.name}</span>
            <span className="k">Country</span><span className="v">{user?.country}</span>
            <span className="k">KYC status</span>
            <span className="v">{status ? <Chip value={status.status} /> : '—'}</span>
            <span className="k">Settlement wallet</span>
            <span className="v mono" style={{ wordBreak: 'break-all' }}>{user?.walletAddress ?? '—'}</span>
          </div>
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 14 }}>
            Where the money lands is set separately —{' '}
            <Link to="/me/payout-accounts">payout methods</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
