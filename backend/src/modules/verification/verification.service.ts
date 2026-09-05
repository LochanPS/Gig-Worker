// Verification / onboarding (FR-1). Self-serve signup already creates the User
// (auth /register). This closes the loop: a freelancer submits KYC (or a company
// submits KYB), we provision a demo custodial wallet, issue a Verifiable
// Credential (keccak256 hash mirrored to the IdentityRegistry via the settlement
// seam), and flip the profile to VERIFIED — so a brand-new signup can actually be
// paid (EscrowVault.fund()'s verified-party gate passes).
//
// DEMO NOTE: the mock KYC/KYB check auto-approves any well-formed submission. The
// real integration point (Sumsub/Persona/Onfido) drops in behind submitKyc/Kyb
// exactly here; nothing downstream changes.
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';
import { keccak256, toUtf8 } from '../../lib/hash.js';
import { resolveWallet } from '../../lib/wallet.js';
import { getSettlement } from '../settlement/settlement.interface.js';
import { notify } from '../notifications/notification.service.js';
import { isSanctioned } from '../compliance/rules/sanctions.js';
import type { VerificationResult } from '@gigbridge/shared';

// Mock KYC/KYB adjudication. Real vendors (Sumsub/Persona/Signzy) drop in here.
// A submission is REJECTED when the party is on the sanctions watchlist, the tax
// id is too short/malformed, or the document reference contains "fail" (a demo
// lever so the failing-KYC branch is easy to show). Returns null when it passes.
function rejectionReason(name: string, taxId: string, documentRef: string): string | null {
  if (isSanctioned(name)) return 'Name matches a sanctions/watchlist entry — manual review required.';
  if (taxId.trim().length < 4) return 'Tax ID / PAN is invalid or too short.';
  if (documentRef.toLowerCase().includes('fail')) return 'Document could not be verified (unreadable or mismatched).';
  return null;
}

// Provision a custodial demo wallet (idempotent) + issue an on-chain-anchored
// credential (idempotent per user). Returns the credential hash + wallet address.
export async function provision(userId: string, name: string): Promise<{ hash: string; walletAddress: string }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  let walletAddress = user.walletAddress;
  if (!walletAddress) {
    // Generated pair — the address IS the address of the key, so settlement can
    // pay this account rather than deriving a different one behind the UI's back.
    const w = resolveWallet({}); // DEMO ONLY: the platform custodies the key
    walletAddress = w.address;
    await prisma.user.update({
      where: { id: userId },
      data: { walletAddress: w.address, walletKey: w.key, walletSource: w.source },
    });
  }

  const hash = keccak256(toUtf8(userId));
  const existing = await prisma.credential.findFirst({ where: { userId, revoked: false } });
  if (!existing) {
    // Anchor the credential hash through the settlement seam: simulated returns a
    // valid-looking tx hash; real settlement anchors it on the AuditAnchor contract.
    const anchor = await getSettlement().anchorDecision(hash);
    await prisma.credential.create({
      data: {
        userId,
        did: `did:gigbridge:${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        credentialJs: 'ENCRYPTED_DEMO',
        hash,
        expiresAt: new Date(Date.now() + 365 * 86_400_000),
        anchorTxHash: anchor.txHash,
      },
    });
  }
  return { hash, walletAddress };
}


export async function submitKyc(
  freelancerId: string,
  input: { panOrTaxId: string; documentType: string; documentRef: string },
): Promise<VerificationResult> {
  const profile = await prisma.freelancerProfile.findUnique({ where: { userId: freelancerId } });
  if (!profile) throw Object.assign(new Error('Not a freelancer account'), { statusCode: 400 });

  const reason = rejectionReason(profile.fullName, input.panOrTaxId, input.documentRef);
  if (reason) {
    await prisma.freelancerProfile.update({ where: { userId: freelancerId }, data: { panOrTaxId: input.panOrTaxId, kycStatus: 'REJECTED' } });
    await audit(freelancerId, 'KYC_REJECTED', `user:${freelancerId}`, null, { reason });
    await notify(freelancerId, 'KYC_REJECTED', `Verification failed: ${reason} You can correct your details and resubmit.`);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: freelancerId } });
    return { userId: freelancerId, status: 'REJECTED', reason, credentialHash: null, walletAddress: user.walletAddress };
  }

  const { hash, walletAddress } = await provision(freelancerId, profile.fullName);
  await prisma.freelancerProfile.update({
    where: { userId: freelancerId },
    data: { panOrTaxId: input.panOrTaxId, kycStatus: 'VERIFIED' },
  });
  await audit(freelancerId, 'KYC_VERIFIED', `user:${freelancerId}`, { kycStatus: 'PENDING' }, { kycStatus: 'VERIFIED', documentType: input.documentType });
  await notify(freelancerId, 'KYC_VERIFIED', 'Identity verified — add a payout account to receive payments.');
  return { userId: freelancerId, status: 'VERIFIED', reason: null, credentialHash: hash, walletAddress };
}

export async function submitKyb(
  companyId: string,
  input: { legalName: string; regNumber: string; country: string },
): Promise<VerificationResult> {
  const profile = await prisma.companyProfile.findUnique({ where: { userId: companyId } });
  if (!profile) throw Object.assign(new Error('Not a company account'), { statusCode: 400 });

  const reason = rejectionReason(input.legalName, input.regNumber, input.regNumber);
  if (reason) {
    await prisma.companyProfile.update({ where: { userId: companyId }, data: { legalName: input.legalName, regNumber: input.regNumber, country: input.country, kybStatus: 'REJECTED' } });
    await audit(companyId, 'KYB_REJECTED', `user:${companyId}`, null, { reason });
    await notify(companyId, 'KYB_REJECTED', `Business verification failed: ${reason} You can correct your details and resubmit.`);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: companyId } });
    return { userId: companyId, status: 'REJECTED', reason, credentialHash: null, walletAddress: user.walletAddress };
  }

  const { hash, walletAddress } = await provision(companyId, input.legalName);
  await prisma.companyProfile.update({
    where: { userId: companyId },
    data: { legalName: input.legalName, regNumber: input.regNumber, country: input.country, kybStatus: 'VERIFIED' },
  });
  await audit(companyId, 'KYB_VERIFIED', `user:${companyId}`, { kybStatus: 'PENDING' }, { kybStatus: 'VERIFIED', regNumber: input.regNumber });
  await notify(companyId, 'KYB_VERIFIED', 'Business verified — you can now send payouts.');
  return { userId: companyId, status: 'VERIFIED', reason: null, credentialHash: hash, walletAddress };
}

// Current verification status for the logged-in user (drives the onboarding banner).
export async function getVerificationStatus(userId: string): Promise<VerificationResult> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { company: true, freelancer: true, credentials: { where: { revoked: false }, take: 1 } },
  });
  const status = user.company?.kybStatus ?? user.freelancer?.kycStatus ?? 'VERIFIED'; // admin: n/a
  return {
    userId,
    status,
    reason: null,
    credentialHash: user.credentials[0]?.hash ?? null,
    walletAddress: user.walletAddress,
  };
}

// Admin verification (BUILD_CONTRACTS §4: POST /admin/verify/:userId). The
// operator marks a party verified out of band — the same provision-and-issue path
// the self-serve flow uses, so a credential issued either way is identical.
export async function adminVerify(userId: string, adminId: string): Promise<VerificationResult> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { company: true, freelancer: true },
  });
  if (user.role === 'ADMIN') {
    throw Object.assign(new Error('Admins do not hold a KYC/KYB credential'), { statusCode: 400 });
  }

  const name = user.company?.legalName ?? user.freelancer?.fullName ?? user.name;
  const { hash, walletAddress } = await provision(userId, name);

  if (user.company) {
    await prisma.companyProfile.update({ where: { userId }, data: { kybStatus: 'VERIFIED' } });
  } else {
    await prisma.freelancerProfile.update({ where: { userId }, data: { kycStatus: 'VERIFIED' } });
  }

  await audit(adminId, user.company ? 'ADMIN_KYB_VERIFIED' : 'ADMIN_KYC_VERIFIED', `user:${userId}`, null, { by: adminId });
  await notify(userId, 'VERIFIED', 'Your account was verified by the platform operator.');
  return { userId, status: 'VERIFIED', reason: null, credentialHash: hash, walletAddress };
}
