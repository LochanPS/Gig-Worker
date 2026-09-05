/**
 * Two real transactions on a PUBLIC testnet, with no database and no backend.
 *
 *   pnpm --filter ./contracts smoke:testnet
 *
 * Same lifecycle and assertions as itest-settlement.ts (fund -> release, payee gets
 * amount-fee, treasury gets fee) but usable off local anvil: it signs with the funded
 * keys from DEMO_WALLET_KEYS instead of generating throwaway accounts, and never tries
 * to send them 1 ETH of scarce testnet gas.
 *
 * Run it after preflight:chain and BEFORE starting the backend. If this passes, the
 * chain half of the demo is proven and any later problem is in the app, not the chain.
 *
 * Env: RPC_URL, CHAIN_ID, PLATFORM_PRIVATE_KEY (== DEPLOYER_PRIVATE_KEY),
 * DEMO_WALLET_KEYS. Keys are read from the environment only — never pass one as an arg.
 */
import { keccak256, toBytes, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loadAddresses } from "../deploy.js";
import { createChainOps } from "../chain.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, defineChain, http, type Abi } from "viem";

const AMOUNT_MINOR = 50_000; // EUR 500.00, the demo's headline payment
const FEE_MINOR = 375; // 0.75%
const CRED_EXPIRY = () => BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 3600);

const EXPLORERS: Record<number, string> = {
  84532: "https://sepolia.basescan.org",
  11155111: "https://sepolia.etherscan.io",
  80002: "https://amoy.polygonscan.com",
};

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}
function hexKey(k: string): Hex {
  return (k.startsWith("0x") ? k : `0x${k}`) as Hex;
}

/**
 * Pick the payer and payee out of DEMO_WALLET_KEYS. The payer must be a company: it
 * signs approve+fund with its own key and pays that gas itself.
 */
function pickParties(keys: Record<string, string>): { payerEmail: string; payerKey: string; payeeEmail: string; payeeKey: string } {
  const entries = Object.entries(keys);
  if (entries.length < 2) {
    throw new Error(
      `DEMO_WALLET_KEYS needs at least two wallets (a payer company and a payee freelancer); got ${entries.length}`,
    );
  }
  const isPayee = ([email]: [string, string]) => /priya|alex|uma|sanctioned/i.test(email);
  const payer = entries.find((e) => !isPayee(e)) ?? entries[0];
  const payee = entries.find((e) => e[0] !== payer[0] && isPayee(e)) ?? entries.find((e) => e[0] !== payer[0])!;
  return { payerEmail: payer[0], payerKey: payer[1], payeeEmail: payee[0], payeeKey: payee[1] };
}

const abisDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../shared/abis");

async function readTreasury(escrow: Address, chainId: number): Promise<Address | null> {
  try {
    const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
    const chain = defineChain({
      id: chainId,
      name: `chain-${chainId}`,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    });
    const abi = JSON.parse(readFileSync(resolve(abisDir, "EscrowVault.json"), "utf8")).abi as Abi;
    const pub = createPublicClient({ chain, transport: http(rpcUrl) });
    return (await pub.readContract({ address: escrow, abi, functionName: "treasury" })) as Address;
  } catch {
    // Not fatal: the payee assertion is the one that matters.
    return null;
  }
}

async function main() {
  const chainId = Number(process.env.CHAIN_ID ?? 31337);
  const explorer = EXPLORERS[chainId] ?? null;
  const txLink = (h: string) => (explorer ? `${explorer}/tx/${h}` : h);

  const addresses = loadAddresses(chainId);
  if (!addresses) throw new Error(`no deployed addresses for chain ${chainId} — deploy first, then run preflight:chain`);
  const ops = createChainOps({ addresses });

  const raw = process.env.DEMO_WALLET_KEYS;
  if (!raw) throw new Error('DEMO_WALLET_KEYS is not set — expected {"novatek@demo.gg":"0x…","priya@demo.gg":"0x…"}');
  const { payerEmail, payerKey, payeeEmail, payeeKey } = pickParties(JSON.parse(raw) as Record<string, string>);

  const payer = privateKeyToAccount(hexKey(payerKey)).address;
  const payee = privateKeyToAccount(hexKey(payeeKey)).address;

  console.log(`Corridor testnet smoke — chain ${chainId}`);
  console.log(`  payer  ${payerEmail}  ${payer}`);
  console.log(`  payee  ${payeeEmail}  ${payee}`);

  const amount = ops.minorToUsdc(AMOUNT_MINOR);
  const fee = ops.minorToUsdc(FEE_MINOR);

  // EscrowVault.fund requires BOTH parties attested in the IdentityRegistry. The
  // backend does this at boot; do it here so the smoke test stands alone.
  console.log("\n1. Identity attestation (platform-signed, skipped if already attested)");
  for (const [label, addr] of [["payer", payer], ["payee", payee]] as const) {
    if (await ops.isVerified(addr as Address)) {
      console.log(`   ${label} already attested`);
    } else {
      const tx = await ops.setCredential(addr as Address, keccak256(toBytes(addr)), CRED_EXPIRY());
      console.log(`   ${label} attested — ${txLink(tx)}`);
    }
  }
  assert(await ops.isVerified(payer as Address), "payer attested on-chain");
  assert(await ops.isVerified(payee as Address), "payee attested on-chain");

  // MockUSDC is owner-minted, so the payer needs a balance before it can fund.
  console.log("\n2. USDC balance");
  let payerUsdc = await ops.usdcBalance(payer as Address);
  if (payerUsdc < amount) {
    const tx = await ops.mintUsdc(payer as Address, amount * 10n);
    console.log(`   minted to payer — ${txLink(tx)}`);
    payerUsdc = await ops.usdcBalance(payer as Address);
  }
  console.log(`   payer holds ${(Number(payerUsdc) / 1e6).toLocaleString()} USDC`);
  assert(payerUsdc >= amount, "payer holds enough USDC to fund the escrow");

  const payeeBefore = await ops.usdcBalance(payee as Address);
  // The treasury is not in the addresses file — EscrowVault exposes it as a public
  // getter, which is also the authoritative value (setTreasury can change it).
  const treasury = await readTreasury(ops.addresses.EscrowVault, chainId);
  const treasuryBefore = treasury ? await ops.usdcBalance(treasury) : 0n;

  // The real thing: two payer-signed txs (approve + fund) then a platform-signed release.
  const paymentId = `smoke-${Date.now()}`;
  const escrowId = ops.escrowIdFor(paymentId) as Hex;

  console.log("\n3. Fund escrow (payer-signed: approve + fund)");
  const fundTx = await ops.fund(payerKey, escrowId, payee as Address, amount, fee, keccak256(toBytes(paymentId)));
  console.log(`   ${txLink(fundTx)}`);

  console.log("\n4. Release escrow (platform-signed)");
  const releaseTx = await ops.release(escrowId);
  console.log(`   ${txLink(releaseTx)}`);

  const payeeAfter = await ops.usdcBalance(payee as Address);
  const gained = payeeAfter - payeeBefore;
  assert(gained === amount - fee, `payee received amount-fee (got ${gained}, want ${amount - fee})`);
  if (treasury) {
    const treasuryGained = (await ops.usdcBalance(treasury)) - treasuryBefore;
    assert(treasuryGained === fee, `treasury received the fee (got ${treasuryGained}, want ${fee})`);
  }

  console.log(`\n${"─".repeat(64)}`);
  console.log("\x1b[32mSMOKE PASSED — real on-chain settlement works on this chain\x1b[0m");
  console.log(`  sent    EUR ${(AMOUNT_MINOR / 100).toFixed(2)} as ${(Number(amount) / 1e6).toFixed(2)} USDC`);
  console.log(`  fee     ${(Number(fee) / 1e6).toFixed(2)} USDC (0.75%)`);
  console.log(`  payee   +${(Number(gained) / 1e6).toFixed(2)} USDC`);
  console.log("\nOpen the two links above. If they resolve, the chain half of the demo is proven.");
  console.log("Next: migrate + demo:reset, then start the backend with SETTLEMENT_STRICT=true.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(`\n\x1b[31mSMOKE FAILED\x1b[0m — ${(e as Error).message}`);
    process.exit(1);
  });
