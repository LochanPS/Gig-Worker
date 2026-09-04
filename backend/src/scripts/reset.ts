// demo:reset — wipe all data and reseed to the pristine demo state.
// Truncates in FK-safe order (children first), then runs the seed script.
// Redeploying contracts to anvil is P1's deploy.ts, invoked separately at boot.
import { execSync } from 'node:child_process';
import { prisma } from '../lib/db.js';

async function wipe() {
  // Order matters: delete children before parents. The pay-run, schedule, payout
  // account and dispute tables arrived after this script was first written and
  // were never added here, so demo:reset failed on a foreign-key violation the
  // moment anyone had used a batch pay-run — the one thing the roadmap marks
  // NEVER CUT. Payment carries FKs to PayRun and PayoutSchedule, so it goes
  // before them; Dispute and Invoice reference Payment, so they go before it.
  await prisma.timelineStep.deleteMany();
  await prisma.complianceDecision.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.payRun.deleteMany();
  await prisma.payoutSchedule.deleteMany();
  await prisma.payoutAccount.deleteMany();
  await prisma.fxRate.deleteMany();
  await prisma.credential.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.companyProfile.deleteMany();
  await prisma.freelancerProfile.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log('Resetting demo state...');
  await wipe();
  await prisma.$disconnect();
  // Re-run the seed as a child process (fresh Prisma client, clean exit codes).
  execSync('tsx src/scripts/seed.ts', { stdio: 'inherit', cwd: process.cwd() });
  console.log('Demo reset complete.');
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
