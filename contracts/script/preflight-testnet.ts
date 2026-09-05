/**
 * Pre-demo chain preflight. Answers one question: if I start the backend with
 * SETTLEMENT_MODE=real right now, will it actually settle on-chain?
 *
 * Run BEFORE the backend, and before you are on stage:
 *   pnpm --filter ./contracts preflight:chain
 *
 * Needs no database and no backend — that is the point. It isolates chain problems
 * from app problems, because the backend's default behaviour on a chain failure is to
 * fall back to SIMULATED settlement, whose tx hashes are random bytes that look
 * exactly like real ones (see backend/src/modules/settlement/settlement.interface.ts).
 *
 * Reads only env: RPC_URL, CHAIN_ID, PLATFORM_PRIVATE_KEY, DEPLOYER_PRIVATE_KEY,
 * DEMO_WALLET_KEYS, TREASURY_ADDRESS. Never pass a key on the command line.
 */
import { createPublicClient, defineChain, formatEther, getAddress, http, type Abi, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loadAddresses } from "../deploy.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const abisDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../shared/abis");
const abiOf = (n: string): Abi => JSON.parse(readFileSync(resolve(abisDir, `${n}.json`), "utf8")).abi as Abi;

const EXPLORERS: Record<number, string> = {
  84532: "https://sepolia.basescan.org",
  11155111: "https://sepolia.etherscan.io",
  80002: "https://amoy.polygonscan.com",
};

// The payer signs its own approve+fund, so it needs gas. Two txs of ~100k gas on an
// L2 is far under this, but a wallet below it is a demo about to fail mid-payment.
const MIN_PAYER_ETH = 2n * 10n ** 15n; // 0.002 ETH

let failures = 0;
let warnings = 0;
const pass = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m: string) => { failures++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };
const warn = (m: string) => { warnings++; console.log(`  \x1b[33m!\x1b[0m ${m}`); };
const head = (m: string) => console.log(`\n${m}`);

function hexKey(k: string): `0x${string}` {
  return (k.startsWith("0x") ? k : `0x${k}`) as `0x${string}`;
}

async function main() {
  const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
  const chainId = Number(process.env.CHAIN_ID ?? 31337);
  const explorer = EXPLORERS[chainId] ?? null;
  const link = (kind: "address" | "tx", v: string) => (explorer ? `${explorer}/${kind}/${v}` : v);

  console.log(`Corridor chain preflight\n  RPC     ${rpcUrl}\n  CHAIN_ID ${chainId}${explorer ? `\n  explorer ${explorer}` : ""}`);

  const chain = defineChain({
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const pub = createPublicClient({ chain, transport: http(rpcUrl) });

  // ---- 1. RPC reachable and is the chain we think it is --------------------
  head("1. RPC");
  let liveChainId: number;
  try {
    liveChainId = await pub.getChainId();
  } catch (err) {
    fail(`cannot reach ${rpcUrl} — ${(err as Error).message}`);
    console.log("\nEverything else depends on the RPC. Fix this first.");
    process.exit(1);
  }
  if (liveChainId === chainId) pass(`reachable, chainId ${liveChainId}`);
  else fail(`RPC reports chainId ${liveChainId} but CHAIN_ID=${chainId} — you would deploy/settle on the wrong chain`);
  pass(`current block ${await pub.getBlockNumber()}`);

  // ---- 2. Contracts deployed ----------------------------------------------
  head("2. Contracts");
  const addresses = loadAddresses(chainId);
  if (!addresses) {
    fail(`no addresses for chain ${chainId} — expected shared/abis/addresses.${chainId}.json or DEPLOYED_ADDRESSES`);
    console.log(`\n  Deploy with:\n    RPC_URL=… CHAIN_ID=${chainId} DEPLOYER_PRIVATE_KEY=… pnpm --filter ./contracts deploy`);
    process.exit(1);
  }
  const names = ["MockUSDC", "IdentityRegistry", "EscrowVault", "AuditAnchor"] as const;
  for (const n of names) {
    const addr = getAddress(addresses[n]);
    const code = await pub.getCode({ address: addr });
    if (code && code !== "0x") pass(`${n.padEnd(17)} ${link("address", addr)}`);
    else fail(`${n} at ${addr} has NO bytecode on chain ${chainId} — wrong chain, or never deployed`);
  }

  // ---- 3. The platform key owns what it must ------------------------------
  // This is the failure that bites hardest: mintUsdc and setCredential are signed by
  // PLATFORM_PRIVATE_KEY but are onlyOwner on contracts owned by the DEPLOYER, and
  // EscrowVault grants PLATFORM_ROLE only to its deploy-time admin (the deployer).
  // Different keys => the backend's chain handshake throws => silent fallback.
  head("3. Platform key permissions");
  const platformRaw = process.env.PLATFORM_PRIVATE_KEY;
  if (!platformRaw) {
    fail("PLATFORM_PRIVATE_KEY is not set");
  } else {
    const platform = privateKeyToAccount(hexKey(platformRaw)).address;
    pass(`platform address ${link("address", platform)}`);

    const deployerRaw = process.env.DEPLOYER_PRIVATE_KEY;
    if (deployerRaw) {
      const deployer = privateKeyToAccount(hexKey(deployerRaw)).address;
      if (deployer.toLowerCase() === platform.toLowerCase()) pass("PLATFORM_PRIVATE_KEY == DEPLOYER_PRIVATE_KEY");
      else fail(`PLATFORM_PRIVATE_KEY (${platform}) != DEPLOYER_PRIVATE_KEY (${deployer}) — mint/attest are onlyOwner(deployer); use one key for both`);
    } else {
      warn("DEPLOYER_PRIVATE_KEY not set — cannot compare it with the platform key");
    }

    for (const [label, contract] of [["MockUSDC", "MockUSDC"], ["IdentityRegistry", "IdentityRegistry"]] as const) {
      try {
        const owner = (await pub.readContract({
          address: getAddress(addresses[contract]), abi: abiOf(contract), functionName: "owner",
        })) as Address;
        if (owner.toLowerCase() === platform.toLowerCase()) pass(`${label}.owner() is the platform key`);
        else fail(`${label}.owner() is ${owner}, not the platform key — ${contract === "MockUSDC" ? "USDC minting" : "credential attestation"} will revert`);
      } catch (err) {
        fail(`could not read ${label}.owner() — ${(err as Error).message}`);
      }
    }

    try {
      const escrowAbi = abiOf("EscrowVault");
      const role = (await pub.readContract({
        address: getAddress(addresses.EscrowVault), abi: escrowAbi, functionName: "PLATFORM_ROLE",
      })) as `0x${string}`;
      const has = (await pub.readContract({
        address: getAddress(addresses.EscrowVault), abi: escrowAbi, functionName: "hasRole", args: [role, platform],
      })) as boolean;
      if (has) pass("EscrowVault PLATFORM_ROLE held by the platform key (can release/refund)");
      else fail("platform key lacks EscrowVault PLATFORM_ROLE — release and refund will revert");
    } catch (err) {
      fail(`could not check PLATFORM_ROLE — ${(err as Error).message}`);
    }

    const bal = await pub.getBalance({ address: platform });
    if (bal >= MIN_PAYER_ETH) pass(`platform gas ${formatEther(bal)} ETH`);
    else fail(`platform gas ${formatEther(bal)} ETH — it pays for attest/mint/release/anchor; top it up`);
  }

  // ---- 4. Demo wallets ----------------------------------------------------
  // Gas auto-top-up is local-only (real-settlement.ts), so on a public chain the
  // PAYING company must already hold gas. Payees never sign and need none.
  head("4. Demo wallets (DEMO_WALLET_KEYS)");
  let keys: Record<string, string> = {};
  const rawKeys = process.env.DEMO_WALLET_KEYS;
  if (!rawKeys) {
    fail("DEMO_WALLET_KEYS is not set — the seed would give every actor a random, unfunded key");
  } else {
    try {
      keys = JSON.parse(rawKeys) as Record<string, string>;
      if (Object.keys(keys).length === 0) fail("DEMO_WALLET_KEYS parsed to an empty object");
    } catch {
      // seed.ts swallows this silently and falls back to random keys.
      fail("DEMO_WALLET_KEYS is not valid JSON — expected {\"email\":\"0xkey\"}; the seed would silently use random keys");
    }
  }

  const usdcAbi = abiOf("MockUSDC");
  const registryAbi = abiOf("IdentityRegistry");
  for (const [email, key] of Object.entries(keys)) {
    let addr: Address;
    try {
      addr = privateKeyToAccount(hexKey(key)).address;
    } catch {
      fail(`${email}: not a valid private key`);
      continue;
    }
    const [eth, usdc, verified] = await Promise.all([
      pub.getBalance({ address: addr }),
      pub.readContract({ address: getAddress(addresses.MockUSDC), abi: usdcAbi, functionName: "balanceOf", args: [addr] }) as Promise<bigint>,
      pub.readContract({ address: getAddress(addresses.IdentityRegistry), abi: registryAbi, functionName: "isVerified", args: [addr] }) as Promise<boolean>,
    ]);
    console.log(`\n  ${email}`);
    console.log(`    address  ${link("address", addr)}`);
    // A company is a payer: it signs approve+fund itself, so gas is mandatory.
    const isPayer = !/priya|alex|uma|sanctioned/i.test(email);
    const ethStr = `${formatEther(eth)} ETH`;
    if (eth >= MIN_PAYER_ETH) pass(`  gas      ${ethStr}`);
    else if (isPayer) fail(`  gas      ${ethStr} — this wallet PAYS and signs its own approve+fund; fund it from a Base Sepolia faucet`);
    else pass(`  gas      ${ethStr} (payee — never signs, no gas needed)`);
    console.log(`    USDC     ${(Number(usdc) / 1e6).toLocaleString()} (minted by the platform at backend boot if short)`);
    if (verified) pass("  on-chain identity attested (EscrowVault.fund will accept it)");
    else warn("  not yet attested on-chain — the backend attests at boot under SETTLEMENT_MODE=real");
  }

  // ---- verdict ------------------------------------------------------------
  console.log(`\n${"─".repeat(64)}`);
  if (failures === 0) {
    console.log(`\x1b[32mPREFLIGHT PASSED\x1b[0m${warnings ? ` (${warnings} warning${warnings > 1 ? "s" : ""})` : ""}`);
    console.log("Next: pnpm --filter ./contracts smoke:testnet   # two real transactions");
  } else {
    console.log(`\x1b[31mPREFLIGHT FAILED — ${failures} problem${failures > 1 ? "s" : ""}\x1b[0m`);
    console.log("Do not start the demo. With SETTLEMENT_STRICT=true the backend will refuse to boot;");
    console.log("without it, it will fall back to simulated settlement and every tx hash will be fake.");
  }
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\npreflight crashed: ${(err as Error).message}`);
  process.exit(1);
});
