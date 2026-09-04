// Freelancer roster (FR-6.1). Until now the payout wizard shipped a hardcoded
// list of three seeded UUIDs, so a freelancer who signed up for real could never
// be selected as a payee. This serves the actual roster, with the verification
// and payout-destination facts the wizard needs to warn before confirming.
import type { Currency, FreelancerSummary, KycStatus } from '@gigbridge/shared';
import { prisma } from '../../lib/db.js';

// Pure — decides whether a freelancer can actually receive money today.
// Both halves matter: an unverified payee fails the EscrowVault verified-party
// gate, and a payee with no active account in the destination currency has
// nowhere for the off-ramp to land (PAYOUT_FAILED).
export function isPayable(kycStatus: KycStatus, payoutCurrencies: string[]): boolean {
  return kycStatus === 'VERIFIED' && payoutCurrencies.length > 0;
}

export async function listFreelancers(): Promise<FreelancerSummary[]> {
  const rows = await prisma.user.findMany({
    where: { role: 'FREELANCER' },
    orderBy: { name: 'asc' },
    include: {
      freelancer: true,
      payoutAccounts: { where: { active: true }, select: { currency: true } },
    },
  });

  return rows.map((u) => {
    const payoutCurrencies = [...new Set(u.payoutAccounts.map((a) => a.currency))] as Currency[];
    const kycStatus = (u.freelancer?.kycStatus ?? 'PENDING') as KycStatus;
    return {
      id: u.id,
      name: u.name,
      country: u.country,
      kycStatus,
      walletAddress: u.walletAddress,
      payoutCurrencies,
      payable: isPayable(kycStatus, payoutCurrencies),
    };
  });
}
