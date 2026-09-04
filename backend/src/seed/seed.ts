// Demo seed — BUILD_CONTRACTS.txt section 7 (exact names + logins). Idempotent:
// wipes GigBridge tables then reseeds. Safe to run repeatedly.
import { prisma } from "../lib/db.js";
import { config } from "../lib/config.js";
import { hashPassword } from "../auth/password.js";
import { generateDemoWallet } from "../settlement/wallets.js";
import { issueCredential } from "../identity/credentials.js";
import { addToWatchlist } from "../compliance/watchlist.js";
import { corridorOf } from "../lib/money.js";
import { createQuote } from "../fx/service.js";
import { createAndScreen, confirmAndSettle } from "../payments/orchestrator.js";
import type { Currency, PurposeCode } from "@gigbridge/shared";

const PW = "demo1234";

async function wipe(): Promise<void> {
  // Order respects FK constraints.
  await prisma.timelineEntry.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.payment.updateMany({ data: { complianceDecisionId: null } });
  await prisma.complianceDecision.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.fxRate.deleteMany();
  await prisma.credential.deleteMany();
  await prisma.companyProfile.deleteMany();
  await prisma.freelancerProfile.deleteMany();
  await prisma.user.deleteMany();
}

async function makeCompany(email: string, name: string, country: string, regNumber: string) {
  const wallet = generateDemoWallet();
  return prisma.user.create({
    data: {
      email,
      name,
      country,
      role: "COMPANY",
      passwordHash: await hashPassword(PW),
      walletAddress: wallet.address,
      companyProfile: {
        create: { legalName: name, regNumber, country, kybStatus: "PENDING", demoWalletKey: wallet.privateKey },
      },
    },
  });
}

async function makeFreelancer(
  email: string,
  name: string,
  country: string,
  pan: string | null,
) {
  const wallet = generateDemoWallet();
  return prisma.user.create({
    data: {
      email,
      name,
      country,
      role: "FREELANCER",
      passwordHash: await hashPassword(PW),
      walletAddress: wallet.address,
      freelancerProfile: {
        create: { fullName: name, country, panOrTaxId: pan, kycStatus: "PENDING", demoWalletKey: wallet.privateKey },
      },
    },
  });
}

export async function seed(): Promise<void> {
  console.log("Seeding GigBridge demo data...");

  // Real settlement mode issues on-chain credentials + faucets during seeding,
  // so the contracts must exist first. ensureDeployed() is a no-op if they do.
  if (config.chain.mode === "real") {
    const { ensureDeployed } = await import("@gigbridge/contracts");
    await ensureDeployed({
      rpcUrl: config.chain.rpcUrl,
      chainId: config.chain.chainId,
      deployerKey: config.chain.deployerPrivateKey || config.chain.platformPrivateKey || undefined,
      treasury: config.chain.treasuryAddress || undefined,
    });
    console.log("  contracts deployed for real-settlement seed");
  }

  await wipe();

  const admin = await prisma.user.create({
    data: {
      email: "admin@demo.gg",
      name: "Platform Admin",
      country: "DE",
      role: "ADMIN",
      passwordHash: await hashPassword(PW),
    },
  });

  // Companies
  const novatek = await makeCompany("novatek@demo.gg", "Novatek GmbH", "DE", "HRB-102934");
  const chennai = await makeCompany("chennai@demo.gg", "Chennai Softworks", "IN", "U72900TN2019");

  // Freelancers
  const priya = await makeFreelancer("priya@demo.gg", "Priya Sharma", "IN", "ABCDE1234F");
  const alex = await makeFreelancer("alex@demo.gg", "Alex Carter", "US", "TAX-US-9911");
  await makeFreelancer("uma@demo.gg", "Uma Rao", "IN", null); // KYC pending (left unverified)

  // Verify everyone except Uma (issues VC + mirrors hash on-chain, flips status).
  for (const u of [novatek, chennai, priya, alex]) {
    await issueCredential(u.id, admin.id);
  }

  // Watchlist: SanctionedCo entity + one freelancer alias (US-OFAC-001 demo).
  addToWatchlist("SanctionedCo");
  addToWatchlist("uma rao (alias)");

  // ~40 completed payments over 30 days across EURINR/USDINR for charts.
  await seedHistory(novatek.id, priya.id, "EUR", "INR", "P0802", 22);
  await seedHistory(chennai.id, alex.id, "USD", "INR", "P0801", 18);

  // One pre-built structuring alert: 3 payments of EUR 9,400 within 72h.
  await seedStructuring(novatek.id, priya.id);

  console.log("Seed complete.");
  console.log("Logins (password demo1234): admin@demo.gg, novatek@demo.gg, chennai@demo.gg, priya@demo.gg, alex@demo.gg, uma@demo.gg");
}

async function seedHistory(
  companyId: string,
  freelancerId: string,
  src: Currency,
  dst: Currency,
  purpose: PurposeCode,
  count: number,
): Promise<void> {
  for (let i = 0; i < count; i++) {
    // Amounts small enough to auto-APPROVE (below EDD/PAN thresholds).
    const amountMinor = (200 + Math.round(Math.random() * 300)) * 100; // 200..500
    const daysAgo = Math.floor((i / count) * 30);
    const createdAt = new Date(Date.now() - daysAgo * 86_400_000 - i * 3600_000);

    const p = await createAndScreen({
      companyId,
      input: {
        companyId,
        freelancerId,
        payerName: "seed",
        payeeName: "seed",
        payerCountry: src === "EUR" ? "DE" : "IN",
        payeeCountry: "IN",
        srcCurrency: src,
        dstCurrency: dst,
        srcAmountMinor: amountMinor,
        purposeCode: purpose,
        freelancerHasPan: true,
      },
    });
    if (p.state === "COMPLIANCE_CHECK") {
      const quote = await createQuote(corridorOf(src, dst), amountMinor);
      await confirmAndSettle(p.id, quote.quoteId, companyId).catch(() => undefined);
    }
    // Backdate the row + timeline so charts show 30 days of history.
    await prisma.payment.update({ where: { id: p.id }, data: { createdAt, completedAt: createdAt } });
    await prisma.timelineEntry.updateMany({ where: { paymentId: p.id }, data: { at: createdAt } });
  }
}

async function seedStructuring(companyId: string, freelancerId: string): Promise<void> {
  // 3 x EUR 9,400 within 72h -> GB-STR-001 flags + a STRUCTURING alert.
  for (let i = 0; i < 3; i++) {
    const createdAt = new Date(Date.now() - i * 20 * 3600_000); // within 72h
    const p = await createAndScreen({
      companyId,
      input: {
        companyId,
        freelancerId,
        payerName: "seed",
        payeeName: "seed",
        payerCountry: "DE",
        payeeCountry: "IN",
        srcCurrency: "EUR",
        dstCurrency: "INR",
        srcAmountMinor: 9_400_00,
        purposeCode: "P0802",
        freelancerHasPan: true,
      },
    });
    await prisma.payment.update({ where: { id: p.id }, data: { createdAt } });
  }
}

// Auto-run only when invoked directly (`tsx src/seed/seed.ts`), not on import.
const invokedDirectly =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  seed()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
