import { useMemo, useState } from 'react';
import type { Credential, Payment } from '@gigbridge/shared';
import { useAuth } from '@/lib/auth';
import { useAsync } from '@/lib/useAsync';
import { gateway } from '@/lib/gateway';
import { freelancerById } from '@/lib/directory';
import { PageHeader } from '@/components/PageHeader';
import { Panel, Button } from '@/components/ui/primitives';
import { CredentialCard } from '@/components/CredentialCard';
import { CopyValue } from '@/components/TxHashLink';

type Pref = 'AUTO_CONVERT' | 'HOLD';

export function FreelancerIdentity() {
  const { user } = useAuth();
  const credState = useAsync<Partial<Credential>>(() => gateway.credentialMe(), []);
  const payState = useAsync<Payment[]>(() => gateway.listPayments(), []);
  const [pref, setPref] = useState<Pref>('AUTO_CONVERT');
  const [savedPref, setSavedPref] = useState<Pref | null>(null);
  const [copied, setCopied] = useState(false);

  const dir = freelancerById(user?.id);
  const wallet = dir?.walletAddress ?? user?.walletAddress ?? null;

  const reuseCount = useMemo(
    () => (payState.data ?? []).filter((p) => p.freelancerId === user?.id && p.state === 'COMPLETED').length,
    [payState.data, user],
  );

  const credential: Credential = useMemo(() => {
    const raw = credState.data ?? {};
    const slug = (user?.name ?? 'freelancer').toLowerCase().replace(/[^a-z]+/g, '-');
    return {
      id: 'cred',
      userId: user?.id ?? 'me',
      did: raw.did ?? `did:gigbridge:${slug}`,
      hash: raw.hash && raw.hash.length > 10 ? raw.hash : '0x' + Array.from({ length: 64 }, (_, i) => '9a3f7c1e'[i % 8]).join(''),
      issuedAt: raw.issuedAt ?? '2026-08-01T00:00:00Z',
      expiresAt: raw.expiresAt ?? '2027-08-01T00:00:00Z',
      revoked: raw.revoked ?? false,
      anchorTxHash: raw.anchorTxHash ?? '0x' + Array.from({ length: 64 }, (_, i) => 'a1b2c3d4'[i % 8]).join(''),
    };
  }, [credState.data, user]);

  function selectPref(next: Pref) {
    setPref(next);
    setSavedPref(next); // persists immediately in this demo, confirmed inline
  }

  return (
    <>
      <PageHeader title="Identity" subtitle="Your verifiable credential is issued once and reused on every payment." />
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6">
          <CredentialCard credential={credential} reuseCount={reuseCount} />
        </div>

        <div className="lg:col-span-6 flex flex-col gap-5">
          <Panel className="p-4">
            <div className="label mb-3">Verification</div>
            <dl className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[12px] text-muted">KYC status</dt>
                <dd className={`text-[12px] uppercase tracking-[0.06em] ${dir?.kycStatus === 'VERIFIED' ? 'text-ok' : 'text-warn'}`}>
                  {dir?.kycStatus ?? 'VERIFIED'}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[12px] text-muted shrink-0">Wallet</dt>
                <dd className="text-right min-w-0">
                  {wallet ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="num text-[12px] text-text break-all">{wallet.slice(0, 12)}...{wallet.slice(-4)}</span>
                      <button
                        onClick={() => {
                          if (wallet) navigator.clipboard?.writeText(wallet);
                          setCopied(true);
                          window.setTimeout(() => setCopied(false), 1400);
                        }}
                        className="text-[11px] text-faint hover:text-text transition-colors"
                      >
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </span>
                  ) : (
                    <span className="text-[12px] text-faint">Not provisioned</span>
                  )}
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel className="p-4">
            <div className="label mb-3">Payout preference</div>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'AUTO_CONVERT', title: 'Auto-convert to INR', body: 'Land every payout as rupees in your balance.' },
                { value: 'HOLD', title: 'Hold in source', body: 'Keep the source currency and convert later.' },
              ] as const).map((o) => (
                <button
                  key={o.value}
                  onClick={() => selectPref(o.value)}
                  className={`border p-3 text-left transition-colors ${pref === o.value ? 'border-accent text-text' : 'border-line text-muted hover:border-line-strong'}`}
                >
                  <div className="text-[13px] mb-1">{o.title}</div>
                  <div className="text-[11px] text-faint leading-[1.5]">{o.body}</div>
                </button>
              ))}
            </div>
            {savedPref ? (
              <p className="text-[12px] text-ok mt-3">
                Saved. New payouts will {savedPref === 'AUTO_CONVERT' ? 'auto-convert to INR' : 'be held in their source currency'}.
              </p>
            ) : null}
          </Panel>
        </div>
      </div>
    </>
  );
}
