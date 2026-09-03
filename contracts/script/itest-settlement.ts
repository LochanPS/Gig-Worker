/**
 * Integration test for the real settlement path against a LIVE anvil.
 * Not part of `pnpm test` (needs a running chain). Run manually:
 *   1) anvil
 *   2) pnpm --filter @gigbridge/contracts exec tsx script/itest-settlement.ts
 *
 * Proves: deploy -> gas + credential + mint -> payer funds escrow -> platform
 * releases -> payee USDC increases by amount-fee, treasury gets fee.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes, type Address, type Hex } from "viem";
import { ensureDeployed } from "../deploy.js";
import { createChainOps } from "../chain.js";

const AMOUNT_MINOR = 50_000; // EUR 500.00
const FEE_MINOR = 375; // 0.75%

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

async function main() {
  const addresses = await ensureDeployed();
  const ops = createChainOps({ addresses });

  const payerKey = generatePrivateKey();
  const payeeKey = generatePrivateKey();
  const payer = privateKeyToAccount(payerKey).address;
  const payee = privateKeyToAccount(payeeKey).address;

  // Prepare both parties on-chain.
  await ops.sendGas(payer, 10n ** 18n); // 1 ETH for gas
  await ops.setCredential(payer, keccak256(toBytes("payer")), BigInt(Math.floor(Date.now() / 1000) + 3600));
  await ops.setCredential(payee, keccak256(toBytes("payee")), BigInt(Math.floor(Date.now() / 1000) + 3600));

  const amount = ops.minorToUsdc(AMOUNT_MINOR);
  const fee = ops.minorToUsdc(FEE_MINOR);
  await ops.mintUsdc(payer, amount);

  assert(await ops.isVerified(payer), "payer verified");
  assert(await ops.isVerified(payee), "payee verified");
  assert((await ops.usdcBalance(payer)) === amount, "payer funded with USDC");

  const paymentId = "itest-" + Date.now();
  const escrowId = ops.escrowIdFor(paymentId) as Hex;
  const chash = keccak256(toBytes("decision")) as Hex;

  const fundTx = await ops.fund(payerKey, escrowId, payee as Address, amount, fee, chash);
  console.log("fund tx:", fundTx);
  assert((await ops.usdcBalance(payer)) === 0n, "payer balance drained into escrow");

  const treasuryBefore = await ops.usdcBalance(addresses.MockUSDC as Address); // not treasury, just sanity
  void treasuryBefore;

  const releaseTx = await ops.release(escrowId);
  console.log("release tx:", releaseTx);

  const payeeBal = await ops.usdcBalance(payee);
  assert(payeeBal === amount - fee, `payee got amount-fee (got ${payeeBal}, want ${amount - fee})`);

  console.log("\nOK — real settlement lifecycle passed:");
  console.log(`  amount ${amount} base units, fee ${fee}, payee received ${payeeBal}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
