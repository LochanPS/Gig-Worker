// demo:reset — drop schema -> migrate -> reseed (BUILD_CONTRACTS §7).
// Contract redeploy is handled by P1's deploy-on-boot module; when absent the
// settlement layer runs simulated, so a reseed is enough to restore demo state.
import { execSync } from "node:child_process";
import { prisma } from "../lib/db.js";
import { seed } from "./seed.js";

async function main(): Promise<void> {
  console.log("demo:reset — resetting database schema...");
  // Recreate the schema deterministically. `migrate reset --force` drops + reapplies.
  execSync("prisma migrate reset --force --skip-seed", { stdio: "inherit" });
  await seed();
  await prisma.$disconnect();
  console.log("demo:reset complete.");
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
