// Customer management — create and manage the real parties in the platform
// (companies and freelancers), so the app is operated on live data, not a fixed
// seed. Admins see and create everyone; a company sees the freelancers it can pay.
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import type { CreateCustomerInput, CustomerSummary, Role } from '@gigbridge/shared';
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';
import { keccak256, toUtf8 } from '../../lib/hash.js';
import { getSettlement } from '../settlement/settlement.interface.js';

const wallet = () => '0x' + randomBytes(20).toString('hex');

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
    createdAt: u.createdAt.toISOString(),
    paymentsCount: (u._count?.paymentsSent ?? 0) + (u._count?.paymentsReceived ?? 0),
  };
}

const include = {
  company: true,
  freelancer: true,
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

// Provision wallet + issue an on-chain-anchored credential + mark verified.
async function provision(userId: string, name: string, role: Role) {
  const addr = wallet();
  await prisma.user.update({ where: { id: userId }, data: { walletAddress: addr, walletKey: '0x' + randomBytes(32).toString('hex') } });
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
  if (input.verified) await provision(user.id, input.name, input.role);
  await audit(actor.id, 'CUSTOMER_CREATED', `user:${user.id}`, null, { role: input.role, verified: !!input.verified });
  return getCustomer(user.id);
}
