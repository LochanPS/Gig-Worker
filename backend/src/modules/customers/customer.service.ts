// Customer management — create and manage the real parties in the platform
// (companies and freelancers), so the app is operated on live data, not a fixed
// seed. Admins see and create everyone; a company sees the freelancers it can pay.
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import type { CreateCustomerInput, CustomerSummary, Currency, Role, UpdateWalletInput } from '@gigbridge/shared';
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';
import { keccak256, toUtf8 } from '../../lib/hash.js';
import { resolveWallet, walletSourceOf } from '../../lib/wallet.js';
import { activeDestination } from '../payouts/destination.js';
import { getSettlement } from '../settlement/settlement.interface.js';

// Default off-ramp currency for a payout destination set at creation time. INR is
// the corridor the UPI last mile serves; an operator can pick another.
const DEFAULT_PAYOUT_CURRENCY: Currency = 'INR';

const mask = (acct: string) => (acct.length <= 4 ? acct : '••••' + acct.slice(-4));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSummary(u: any): CustomerSummary {
  const status = u.company?.kybStatus ?? u.freelancer?.kycStatus ?? 'VERIFIED';
  return {
    id: u.id,
    role: u.role as Role,
    name: u.name,
    email: u.email,
    country: u.country,
    status,
    verified: status === 'VERIFIED',
    walletAddress: u.walletAddress ?? null,
    // A party with no stored key cannot sign, so it can be paid but cannot pay.
    canSign: !!u.walletKey,
    walletSource: walletSourceOf(u.walletAddress ?? null, u.walletSource ?? null),
    payoutDestination: activeDestination(u.payoutAccounts),
    createdAt: u.createdAt.toISOString(),
    paymentsCount: (u._count?.paymentsSent ?? 0) + (u._count?.paymentsReceived ?? 0),
  };
}

const include = {
  company: true,
  freelancer: true,
  // Newest first, so activeDestination() picks the same account creditPayee() will.
  payoutAccounts: { orderBy: { createdAt: 'desc' } },
  _count: { select: { paymentsSent: true, paymentsReceived: true } },
} as const;

// Admin sees everyone; a company sees payable freelancers.
export async function listCustomers(actor: { id: string; role: Role }, roleFilter?: Role) {
  const where =
    actor.role === 'ADMIN'
      ? roleFilter
        ? { role: roleFilter }
        : {}
      : { role: 'FREELANCER' as Role }; // company: potential payees
  const rows = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, include });
  return rows.map(toSummary);
}

export async function getCustomer(id: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id }, include });
  return toSummary(u);
}

// Provision the settlement wallet + issue an on-chain-anchored credential + mark
// verified. The wallet is whatever the operator supplied (a real testnet account),
// or a freshly generated pair when they supplied nothing — either way the stored
// address is the address of the stored key, so settlement can trust it.
async function provision(userId: string, name: string, role: Role, input: CreateCustomerInput) {
  const w = resolveWallet(input);
  await prisma.user.update({
    where: { id: userId },
    data: { walletAddress: w.address, walletKey: w.key, walletSource: w.source },
  });
  const hash = keccak256(toUtf8(userId));
  const anchor = await getSettlement().anchorDecision(hash);
  await prisma.credential.create({
    data: { userId, did: `did:corridor:${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`, credentialJs: 'ENCRYPTED_DEMO', hash, expiresAt: new Date(Date.now() + 365 * 86_400_000), anchorTxHash: anchor.txHash },
  });
  if (role === 'COMPANY') await prisma.companyProfile.update({ where: { userId }, data: { kybStatus: 'VERIFIED' } });
  else await prisma.freelancerProfile.update({ where: { userId }, data: { kycStatus: 'VERIFIED' } });
}

export async function createCustomer(actor: { id: string; role: Role }, input: CreateCustomerInput) {
  // A company may only create freelancers (payees); an admin may create either.
  if (actor.role !== 'ADMIN' && input.role !== 'FREELANCER') {
    throw Object.assign(new Error('Only an admin can create a company account'), { statusCode: 403 });
  }
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw Object.assign(new Error('Email already registered'), { statusCode: 409 });

  const passwordHash = await bcrypt.hash(input.password ?? randomBytes(6).toString('hex'), 10);
  const user = await prisma.user.create({
    data: {
      role: input.role,
      email: input.email,
      passwordHash,
      country: input.country.toUpperCase(),
      name: input.name,
      ...(input.role === 'COMPANY'
        ? { company: { create: { legalName: input.legalName ?? input.name, regNumber: input.regNumber ?? 'PENDING', country: input.country.toUpperCase() } } }
        : { freelancer: { create: { fullName: input.name, country: input.country.toUpperCase(), panOrTaxId: input.panOrTaxId ?? null } } }),
    },
  });
  if (input.verified) {
    await provision(user.id, input.name, input.role, input);
  } else if (input.walletAddress || input.walletKey) {
    // An unverified party can still be given its wallet up front — verification
    // only gates the credential, not which account the money is destined for.
    const w = resolveWallet(input);
    await prisma.user.update({
      where: { id: user.id },
      data: { walletAddress: w.address, walletKey: w.key, walletSource: w.source },
    });
  }

  // The off-ramp destination, when the operator set one. Without this a freelancer
  // created here settles on-chain and then dies in PAYOUT_FAILED, because only the
  // payee themself could previously add a payout account.
  if (input.payoutMethod) await createPayoutDestination(user.id, input);

  await audit(actor.id, 'CUSTOMER_CREATED', `user:${user.id}`, null, {
    role: input.role,
    verified: !!input.verified,
    walletSource: input.walletAddress || input.walletKey ? 'PROVIDED' : 'GENERATED',
    payoutMethod: input.payoutMethod ?? null,
  });
  return getCustomer(user.id);
}

// Who may repoint whose wallet. Pure — a wallet decides where money lands, so the
// rule is testable on its own rather than buried in a service call. Mirrors
// createCustomer: an admin manages anyone; anyone may set their own; a company may
// set its payees' (it already does exactly that at creation).
export function canUpdateWallet(
  actor: { id: string; role: Role },
  target: { id: string; role: Role },
): boolean {
  if (actor.role === 'ADMIN') return true;
  if (actor.id === target.id) return true;
  return actor.role === 'COMPANY' && target.role === 'FREELANCER';
}

// Point a party at a different settlement wallet — typically swapping the demo
// wallet the platform generated for a funded account the operator controls.
// Without this the only ways to change a wallet were re-seeding the database or
// editing it by hand, because creation was the sole path that ever set one.
//
// The resolver enforces the same invariant as creation, so an update can never
// reintroduce an address that disagrees with its key.
export async function updateCustomerWallet(
  actor: { id: string; role: Role },
  userId: string,
  input: UpdateWalletInput,
) {
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (!canUpdateWallet(actor, { id: userId, role: target.role as Role })) {
    throw Object.assign(new Error('Not allowed to change this wallet'), { statusCode: 403 });
  }

  const w = resolveWallet(input);
  await prisma.user.update({
    where: { id: userId },
    data: { walletAddress: w.address, walletKey: w.key, walletSource: w.source },
  });
  // Wallets decide where money lands, so a change is recorded with both sides.
  await audit(actor.id, 'CUSTOMER_WALLET_UPDATED', `user:${userId}`,
    { walletAddress: target.walletAddress, canSign: !!target.walletKey },
    { walletAddress: w.address, canSign: !!w.key, source: w.source },
  );
  return getCustomer(userId);
}

// Create the payee's off-ramp destination alongside the account. Mirrors
// addPayoutAccount() (same masking, same fields); the difference is only who may
// call it — POST /payout-accounts is the payee's own self-service route, and this
// is the company/admin creating a payee that is payable from the first payment.
async function createPayoutDestination(userId: string, input: CreateCustomerInput) {
  const isUpi = input.payoutMethod === 'UPI';
  const account = await prisma.payoutAccount.create({
    data: {
      userId,
      label: input.payoutLabel?.trim() || (isUpi ? 'UPI' : 'Bank account'),
      currency: input.payoutCurrency ?? DEFAULT_PAYOUT_CURRENCY,
      method: isUpi ? 'UPI' : 'BANK',
      accountName: isUpi ? null : input.accountName!,
      accountNumberMasked: isUpi ? null : mask(input.accountNumber!),
      bankIdentifier: isUpi ? null : input.bankIdentifier!,
      vpa: isUpi ? input.vpa! : null,
    },
  });
  await audit(userId, 'PAYOUT_ACCOUNT_ADDED', `payoutAccount:${account.id}`, null, {
    currency: account.currency,
    method: account.method,
    viaCustomerCreation: true,
  });
}
