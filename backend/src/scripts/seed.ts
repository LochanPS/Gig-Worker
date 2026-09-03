// Demo seed (BUILD_CONTRACTS §7). Creates the exact actors, credentials, and
// history the four demo scenarios depend on. Idempotent-ish: run after a reset.
// Names/amounts are chosen so the frozen thresholds trigger deterministically.
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/db.js';
import { keccak256, toUtf8 } from '../lib/hash.js';

const PW = 'demo1234';
const wallet = () => '0x' + randomBytes(20).toString('hex');

interface SeedUser {
  id: string;
  role: 'COMPANY' | 'FREELANCER' | 'ADMIN';
  email: string;
  name: string;
  country: string;
  pan?: string | null;
  verified: boolean;
  legalName?: string;
  regNumber?: string;
}

const USERS: SeedUser[] = [
  { id: '11111111-1111-1111-1111-111111111111', role: 'COMPANY', email: 'novatek@demo.gg', name: 'Novatek GmbH', country: 'DE', verified: true, legalName: 'Novatek GmbH', regNumber: 'HRB-198234' },
  { id: '22222222-2222-2222-2222-222222222222', role: 'COMPANY', email: 'chennai@demo.gg', name: 'Chennai Softworks', country: 'IN', verified: true, legalName: 'Chennai Softworks Pvt Ltd', regNumber: 'U72900TN2019PTC' },
  { id: '33333333-3333-3333-3333-333333333333', role: 'FREELANCER', email: 'priya@demo.gg', name: 'Priya Sharma', country: 'IN', pan: 'ABCDE1234F', verified: true },
  { id: '44444444-4444-4444-4444-444444444444', role: 'FREELANCER', email: 'alex@demo.gg', name: 'Alex Carter', country: 'US', pan: 'US-TIN-88123', verified: true },
  { id: '55555555-5555-5555-5555-555555555555', role: 'FREELANCER', email: 'uma@demo.gg', name: 'Uma Rao', country: 'IN', pan: null, verified: false },
  // Sanctioned counterparty for scenario 2 (name matches the mock watchlist).
  { id: '66666666-6666-6666-6666-666666666666', role: 'FREELANCER', email: 'sanctioned@demo.gg', name: 'SanctionedCo', country: 'IN', pan: null, verified: false },
  { id: '99999999-9999-9999-9999-999999999999', role: 'ADMIN', email: 'admin@demo.gg', name: 'Platform Admin', country: 'IN', verified: true },
];

async function seedUser(u: SeedUser) {
  const passwordHash = await bcrypt.hash(PW, 10);
  const addr = u.role === 'ADMIN' ? null : wallet();
  await prisma.user.create({
    data: {
      id: u.id,
      role: u.role,
      email: u.email,
      passwordHash,
      country: u.country,
      name: u.name,
      walletAddress: addr,
      walletKey: addr ? '0x' + randomBytes(32).toString('hex') : null, // DEMO ONLY
      ...(u.role === 'COMPANY'
        ? { company: { create: { legalName: u.legalName!, regNumber: u.regNumber!, country: u.country, kybStatus: u.verified ? 'VERIFIED' : 'PENDING' } } }
        : u.role === 'FREELANCER'
          ? { freelancer: { create: { fullName: u.name, country: u.country, panOrTaxId: u.pan ?? null, kycStatus: u.verified ? 'VERIFIED' : 'PENDING' } } }
          : {}),
    },
  });
  if (u.verified && u.role !== 'ADMIN') {
    await prisma.credential.create({
      data: {
        userId: u.id,
        did: `did:gigbridge:${u.name.toLowerCase().replace(/[^a-z]/g, '')}`,
        credentialJs: 'ENCRYPTED_DEMO',
        hash: keccak256(toUtf8(u.id)),
        expiresAt: new Date(Date.now() + 365 * 86_400_000),
        anchorTxHash: '0x' + randomBytes(32).toString('hex'),
      },
    });
  }
}

// A completed historical payment (feeds overview stats + FX charts + outlier baseline).
async function seedHistoricalPayment(companyId: string, freelancerId: string, daysAgo: number, srcCurrency: string, srcAmountMinor: number, rate: number) {
  const created = new Date(Date.now() - daysAgo * 86_400_000);
  const fee = Math.max(Math.round((srcAmountMinor * 75) / 10_000), 100);
  const p = await prisma.payment.create({
    data: {
      companyId,
      freelancerId,
      srcCurrency,
      dstCurrency: 'INR',
      srcAmountMinor,
      dstAmountMinor: Math.round((srcAmountMinor - fee) * rate),
      feeAmountMinor: fee,
      purposeCode: 'P0802',
      state: 'COMPLETED',
      escrowId: '0x' + randomBytes(16).toString('hex'),
      txHashFund: '0x' + randomBytes(32).toString('hex'),
      txHashRelease: '0x' + randomBytes(32).toString('hex'),
      createdAt: created,
    },
  });
  await prisma.timelineStep.create({ data: { paymentId: p.id, key: 'CREATED', label: 'Payment created', state: 'DRAFT', actor: companyId, at: created } });
  await prisma.timelineStep.create({ data: { paymentId: p.id, key: 'RELEASED', label: 'Released to payee', state: 'COMPLETED', actor: 'platform', at: created } });
}

async function main() {
  console.log('Seeding GigBridge demo data...');
  for (const u of USERS) await seedUser(u);

  const novatek = '11111111-1111-1111-1111-111111111111';
  const chennai = '22222222-2222-2222-2222-222222222222';
  const priya = '33333333-3333-3333-3333-333333333333';
  const alex = '44444444-4444-4444-4444-444444444444';

  // ~40 completed payments over 30 days across two corridors.
  for (let i = 0; i < 30; i++) {
    await seedHistoricalPayment(novatek, priya, i, 'EUR', 20000 + Math.round(Math.random() * 60000), 90.2);
    if (i % 3 === 0) await seedHistoricalPayment(chennai, alex, i, 'USD', 50000 + Math.round(Math.random() * 100000), 83.1);
  }

  // Pre-built structuring pattern for scenario 4: 3 payments just under EUR 10,000
  // within 72h from Novatek -> Alex (each 9,400). Deliberately NOT on the
  // Novatek -> Priya pair so scenario 1 (the happy path) stays a clean APPROVE.
  for (let i = 0; i < 3; i++) {
    await seedHistoricalPayment(novatek, alex, i, 'EUR', 940000, 90.2);
  }
  await prisma.alert.create({
    data: {
      type: 'STRUCTURING',
      severity: 'HIGH',
      details: { pattern: '3 payments of EUR 9,400 within 72h', payer: 'Novatek GmbH', payee: 'Alex Carter' } as never,
    },
  });

  const counts = {
    users: await prisma.user.count(),
    payments: await prisma.payment.count(),
    credentials: await prisma.credential.count(),
    alerts: await prisma.alert.count(),
  };
  console.log('Seed complete:', counts);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
