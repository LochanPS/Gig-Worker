import { buildApp } from "./app.js";
import { config } from "./lib/config.js";
import { prisma } from "./lib/db.js";
import { getSettlement } from "./settlement/index.js";

async function main(): Promise<void> {
  const app = await buildApp();
  const settlement = getSettlement();
  app.log.info(
    { settlement: settlement.mode, agent: config.agent.enabled ? "llm" : "template", fx: config.fx.offline ? "offline" : "live" },
    "GigBridge backend starting",
  );
  await app.listen({ port: config.port, host: "0.0.0.0" });
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

// Graceful shutdown.
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
