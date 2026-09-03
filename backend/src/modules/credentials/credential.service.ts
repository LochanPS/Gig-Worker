// Credential service. Exposes a PII-safe view of a user's verifiable credential
// and renders the credential certificate document. The encrypted credential JSON
// (credentialJs) is NEVER exposed — only the DID, the keccak256 hash mirrored
// on-chain, validity dates, and the IdentityRegistry anchor tx.
import { prisma } from '../../lib/db.js';
import type { Credential } from '@gigbridge/shared';
import { shell, esc } from '../documents/document.service.js';

export type CredentialStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

// Pure — unit-tested without a DB.
export function credentialStatus(
  expiresAt: Date,
  revoked: boolean,
  now: Date = new Date(),
): CredentialStatus {
  if (revoked) return 'REVOKED';
  if (expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  return 'ACTIVE';
}

// Pure — maps a DB credential row to the shared, PII-safe wire shape. Note the
// deliberate absence of credentialJs (the encrypted off-chain credential).
export function publicCredential(c: {
  id: string;
  userId: string;
  did: string;
  hash: string;
  issuedAt: Date;
  expiresAt: Date;
  revoked: boolean;
  anchorTxHash: string | null;
}): Credential {
  return {
    id: c.id,
    userId: c.userId,
    did: c.did,
    hash: c.hash,
    issuedAt: c.issuedAt.toISOString(),
    expiresAt: c.expiresAt.toISOString(),
    revoked: c.revoked,
    anchorTxHash: c.anchorTxHash,
  };
}

// Latest non-revoked credential for a user, PII-safe. Null when the user has none
// (e.g. an unverified freelancer) — the caller turns that into a 404.
export async function activeCredentialForUser(userId: string): Promise<Credential | null> {
  const c = await prisma.credential.findFirst({
    where: { userId, revoked: false },
    orderBy: { issuedAt: 'desc' },
  });
  return c ? publicCredential(c) : null;
}

const STATUS_PILL: Record<CredentialStatus, string> = {
  ACTIVE: 'v-APPROVE',
  EXPIRED: 'v-FLAG',
  REVOKED: 'v-REJECT',
};

export async function credentialHtml(credentialId: string): Promise<string> {
  const c = await prisma.credential.findUniqueOrThrow({
    where: { id: credentialId },
    include: { user: true },
  });
  const status = credentialStatus(c.expiresAt, c.revoked);

  const body = `
  <div class="brand"><h1>Identity Credential</h1><span class="tag">GigBridge · Verifiable Credential</span></div>
  <table>
    <tr><td class="k">Status</td><td class="v"><span class="verdict ${STATUS_PILL[status]}">${esc(status)}</span></td></tr>
    <tr><td class="k">Issued</td><td class="v">${esc(c.issuedAt.toISOString().slice(0, 10))}</td></tr>
    <tr><td class="k">Expires</td><td class="v">${esc(c.expiresAt.toISOString().slice(0, 10))}</td></tr>
  </table>

  <h2>Holder</h2>
  <table>
    <tr><td class="k">Name</td><td class="v">${esc(c.user.name)}</td></tr>
    <tr><td class="k">Role</td><td class="v">${esc(c.user.role)}</td></tr>
    <tr><td class="k">Country</td><td class="v">${esc(c.user.country)}</td></tr>
  </table>

  <h2>Credential</h2>
  <table>
    <tr><td class="k">Decentralised identifier (DID)</td><td class="v mono">${esc(c.did)}</td></tr>
    <tr><td class="k">Credential hash (keccak256)</td><td class="v mono">${esc(c.hash)}</td></tr>
    <tr><td class="k">On-chain anchor (IdentityRegistry)</td><td class="v mono">${esc(c.anchorTxHash ?? '—')}</td></tr>
  </table>

  <div class="stmt">Only the credential <b>hash</b> is mirrored on-chain via IdentityRegistry —
  no personal data leaves the platform (GDPR). Verifiers confirm authenticity by matching
  this hash against the on-chain record; the settlement layer's verified-party gate reads the
  same registry.</div>

  <div class="seal">
    <div class="sig">Authorised signatory<br><span class="mono" style="color:#8695a6">GigBridge Identity</span></div>
    <div class="badge">Demo · not a government-issued credential</div>
  </div>`;

  return shell(`Credential ${c.id.slice(0, 8)}`, body);
}
