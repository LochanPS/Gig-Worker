import { prisma } from "../lib/db.js";
import { encrypt, hash0x } from "../lib/crypto.js";
import { audit } from "../lib/audit.js";
import { getSettlement } from "../settlement/index.js";
import type { CredentialDTO } from "@gigbridge/shared";

const CREDENTIAL_TTL_DAYS = 365;
// Demo faucet size, in USD minor units (cents): 100,000 USD of MockUSDC minted
// to every verified company wallet so it can fund escrows.
const FAUCET_USDC_MINOR = 100_000 * 100;

/**
 * Issues a verifiable credential for a user: builds the VC JSON, encrypts it at
 * rest, hashes it, mirrors the hash to IdentityRegistry on-chain, and marks the
 * user's KYC/KYB VERIFIED. Called by admin verify.
 */
export async function issueCredential(userId: string, actorId: string): Promise<CredentialDTO> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { companyProfile: true, freelancerProfile: true },
  });
  if (!user) throw new Error("user not found");

  const did = `did:gigbridge:${user.id}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CREDENTIAL_TTL_DAYS * 86_400_000);

  const vc = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    type: ["VerifiableCredential", "KYCCredential"],
    id: did,
    issuer: "did:gigbridge:platform",
    issuanceDate: now.toISOString(),
    expirationDate: expiresAt.toISOString(),
    credentialSubject: {
      id: did,
      role: user.role,
      country: user.country,
      // Only non-PII assertions; full PII stays in the DB profile tables.
      kycVerified: true,
    },
  };
  const credentialJson = JSON.stringify(vc);
  const hash = hash0x(credentialJson);

  // Mirror hash on-chain (IdentityRegistry). Simulated when no chain present.
  const settlement = getSettlement();
  const { txHash } = await settlement.setCredential(
    user.walletAddress ?? did,
    hash,
    Math.floor(expiresAt.getTime() / 1000),
  );

  // Faucet: a verified company becomes a payer, so fund its wallet with gas +
  // demo USDC (BUILD_CONTRACTS §2). No-op in simulated mode.
  if (user.role === "COMPANY" && user.walletAddress) {
    await settlement.provisionPayer(user.walletAddress, FAUCET_USDC_MINOR);
  }

  const cred = await prisma.credential.create({
    data: {
      userId: user.id,
      did,
      credentialJson: encrypt(credentialJson),
      hash,
      expiresAt,
      anchorTxHash: txHash,
    },
  });

  // Flip profile verification status.
  if (user.role === "FREELANCER") {
    await prisma.freelancerProfile.update({
      where: { userId: user.id },
      data: { kycStatus: "VERIFIED" },
    });
  } else if (user.role === "COMPANY") {
    await prisma.companyProfile.update({
      where: { userId: user.id },
      data: { kybStatus: "VERIFIED" },
    });
  }

  await audit({
    actorId,
    action: "ISSUE_CREDENTIAL",
    entity: "Credential",
    entityId: cred.id,
    after: { userId, hash, txHash },
  });

  return toCredentialDTO(cred);
}

export function toCredentialDTO(c: {
  id: string;
  did: string;
  hash: string;
  issuedAt: Date;
  expiresAt: Date;
  revoked: boolean;
}): CredentialDTO {
  return {
    id: c.id,
    did: c.did,
    hash: c.hash,
    issuedAt: c.issuedAt.toISOString(),
    expiresAt: c.expiresAt.toISOString(),
    revoked: c.revoked,
  };
}

/** True if the user currently holds a valid (non-revoked, unexpired) credential. */
export async function isVerified(userId: string): Promise<boolean> {
  const cred = await prisma.credential.findFirst({
    where: { userId, revoked: false, expiresAt: { gt: new Date() } },
  });
  return !!cred;
}
