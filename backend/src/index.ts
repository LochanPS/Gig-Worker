import { buildApp } from "./app.js";
import { config } from "./lib/config.js";
import { prisma } from "./lib/db.js";
import { getSettlement } from "./settlement/index.js";

/**
 * In real settlement mode, make sure the four contracts are deployed (no-op if
 * already live at the recorded addresses) and start the on-chain event listener
 * that mirrors escrow events into the logs (PRD FR-5.3 live tx feed).
 */
async function bootChain(app: Awaited<ReturnType<typeof buildApp>>): Promise<void> {
  const { ensureDeployed } = await import("@gigbridge/contracts");
  const { createChainOps } = await import("@gigbridge/contracts/chain");
  const addresses = await ensureDeployed({
    rpcUrl: config.chain.rpcUrl,
    chainId: config.chain.chainId,
    deployerKey: config.chain.deployerPrivateKey || config.chain.platformPrivateKey || undefined,
    treasury: config.chain.treasuryAddress || undefined,
  });
  app.log.info({ contracts: addresses }, "on-chain contracts ready");

  const ops = createChainOps({
    rpcUrl: config.chain.rpcUrl,
    chainId: config.chain.chainId,
    platformKey: config.chain.platformPrivateKey || undefined,
  });
  ops.watchEscrow((e) => {
    app.log.info(
      { event: e.eventName, txHash: e.txHash, block: e.blockNumber?.toString() ?? null },
      "escrow event",
    );
  });
}

async function main(): Promise<void> {
  const app = await buildApp();
  const settlement = getSettlement();
  app.log.info(
    { settlement: settlement.mode, agent: config.agent.enabled ? "llm" : "template", fx: config.fx.offline ? "offline" : "live" },
    "GigBridge backend starting",
  );
  if (config.chain.mode === "real") await bootChain(app);
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
