import type { Credential } from '@gigbridge/shared';
import { formatDate } from '@/lib/format';
import { Panel } from './ui/primitives';
import { CopyValue, TxHashLink } from './TxHashLink';

export function CredentialCard({ credential, reuseCount }: { credential: Credential; reuseCount?: number }) {
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="label">Verifiable credential</span>
        <span className={`text-[11px] uppercase tracking-[0.06em] ${credential.revoked ? 'text-danger' : 'text-ok'}`}>
          {credential.revoked ? 'Revoked' : 'Active'}
        </span>
      </div>
      <dl className="flex flex-col gap-3">
        <Row label="Decentralised identifier">
          <CopyValue value={credential.did} />
        </Row>
        <Row label="Credential hash">
          <CopyValue value={credential.hash} label={`${credential.hash.slice(0, 18)}...`} />
        </Row>
        <Row label="Issued">
          <span className="num text-[12px]">{formatDate(credential.issuedAt)}</span>
        </Row>
        <Row label="Expires">
          <span className="num text-[12px]">{formatDate(credential.expiresAt)}</span>
        </Row>
        {credential.anchorTxHash ? (
          <Row label="On-chain anchor">
            <TxHashLink hash={credential.anchorTxHash} />
          </Row>
        ) : null}
      </dl>
      {reuseCount !== undefined ? (
        <p className="mt-4 pt-4 border-t border-line text-[12px] text-muted leading-[1.55]">
          This credential has been reused for <span className="num text-text">{reuseCount}</span> payments with no
          re-verification. Verification happens once, not once per payment.
        </p>
      ) : null}
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[12px] text-muted shrink-0">{label}</dt>
      <dd className="text-right min-w-0">{children}</dd>
    </div>
  );
}
