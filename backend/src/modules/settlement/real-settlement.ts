/**
 * Real settlement — the viem-backed implementation of the Settlement port
 * (settlement.interface.ts). Swaps in for `simulatedSettlement` when
 * SETTLEMENT_MODE=real, with a safe fallback to simulated if the chain is
 * unreachable (ROADMAP risk R1). Owned by P1 (track/chain); this is the only
 * backend file P1 writes — see docs/CONTRACTS_AND_SETTLEMENT.txt.
 *
 * The low-level viem/ABI wiring lives in @gigbridge/contracts/chain; this file
 * only adapts it to the port and resolves the payer's demo key from the DB.
 */
import { keccak256, parseEther, toBytes, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ensureDeployed } from "@gigbridge/contracts";
import { createChainOps, type ChainOps } from "@gigbridge/contracts/chain";
import { prisma } from "../../lib/db.js";
import { setSettlement, type FundResult, type Settlement } from "./settlement.interface.js";

type Logger = { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
const noopLog: Logger = { info: () => {}, warn: () => {}, error: () => {} };

const CRED_EXPIRY = () => BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 3600);
const GAS_TOPUP = parseEther("1"); // ETH per demo wallet so it can sign txs
const GAS_FLOOR = parseEther("0.1");
const FAUCET_USDC = 1_000_000n * 1_000_000n; // 1,000,000 USDC (6 decimals) per company

/** Credential hash mirrors the DB (keccak256 of the user id). */
function credHash(userId: string): Hex {
  return keccak256(toBytes(userId));
}

/**
 * The demo seed stores walletKey and walletAddress as independent randoms, so
 * the on-chain identity must be derived from the KEY (the actual signer). All
 * chain ops use this; the stored walletAddress is display-only.
 */
function hexKey(k: string): Hex {
  return (k.startsWith("0x") ? k : `0x${k}`) as Hex;
}
function addressOfKey(walletKey: string): Address {
  return privateKeyToAccount(hexKey(walletKey)).address;
}

/** Build the port adapter over the chain ops. */
export function createRealSettlement(ops: ChainOps): Settlement {
  return {
    async fund(paymentId, _payeeWallet, amountMinor, feeMinor, complianceHash): Promise<FundResult> {
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: { company: true, freelancer: true },
      });
      const payerKey = payment.company.walletKey;
      const payeeKey = payment.freelancer.walletKey;
      if (!payerKey) throw new Error(`real-settlement: payer ${payment.companyId} has no demo wallet key`);
      if (!payeeKey) throw new Error(`real-settlement: payee ${payment.freelancerId} has no demo wallet key`);
      // on-chain payee is the key-derived address (see addressOfKey note), not the
      // display walletAddress the orchestrator passes.
      const payee = addressOfKey(payeeKey);

      const escrowId = ops.escrowIdFor(paymentId);
      const amount = ops.minorToUsdc(amountMinor);
      const fee = ops.minorToUsdc(feeMinor);
      const txHash = await ops.fund(payerKey, escrowId, payee, amount, fee, complianceHash as Hex);
      return { txHash, escrowId };
    },

    async release(escrowId) {
      return { txHash: await ops.release(escrowId as Hex) };
    },

    async refund(escrowId) {
      return { txHash: await ops.refund(escrowId as Hex) };
    },

    async anchorDecision(hash) {
      return { txHash: await ops.anchor(hash as Hex) };
    },
  };
}

/**
 * Prepare the chain for the demo: deploy if needed, then for every verified
 * user with a wallet — top up gas, register their credential on-chain, and
 * faucet-mint USDC to company wallets — so EscrowVault.fund()'s verified-party
 * gate and balance checks pass. Idempotent enough for repeated boots.
 */
export async function ensureChainReady(log: Logger = noopLog): Promise<ChainOps> {
  const addresses = await ensureDeployed();
  const ops = createChainOps({ addresses });

  const users = await prisma.user.findMany({
    where: { walletKey: { not: null } },
    include: { company: true, freelancer: true },
  });

  // Gas top-up (1 ETH/wallet) only makes sense on local anvil, where ETH is free.
  // On a PUBLIC testnet we must never spend the platform's scarce testnet ETH one
  // wallet at a time — the real MetaMask accounts hold their own gas. The platform
  // key still pays for mint / attest / release (its own txs).
  const chainId = Number(process.env.CHAIN_ID ?? 31337);
  const isLocal = chainId === 31337;
  if (!isLocal) {
    log.warn(
      "real-settlement: public chain — payer/payee wallets must already hold testnet gas (no per-wallet ETH top-up); the platform key funds only mint/attest/release.",
    );
  }

  for (const u of users) {
    const verified = u.company?.kybStatus === "VERIFIED" || u.freelancer?.kycStatus === "VERIFIED";
    if (!verified || !u.walletKey) continue;
    const wallet = addressOfKey(u.walletKey);

    if (isLocal && (await ops.ethBalance(wallet)) < GAS_FLOOR) {
      await ops.sendGas(wallet, GAS_TOPUP);
    }
    if (!(await ops.isVerified(wallet))) {
      await ops.setCredential(wallet, credHash(u.id), CRED_EXPIRY());
    }
    if (u.company && (await ops.usdcBalance(wallet)) < FAUCET_USDC) {
      await ops.mintUsdc(wallet, FAUCET_USDC);
    }
  }
  log.info(`real-settlement: chain ready (EscrowVault ${addresses.EscrowVault}, chain ${chainId})`);
  return ops;
}

/**
 * Bootstrap hook. When SETTLEMENT_MODE=real, prepare the chain and register the
 * real settlement; on any failure fall back to the simulated settlement so the
 * backend never fails to boot (risk R1). No-op otherwise — simulated stays the
 * default and backend behaviour is unchanged.
 */
export async function enableRealSettlement(log: Logger = noopLog): Promise<boolean> {
  if ((process.env.SETTLEMENT_MODE ?? "simulated").toLowerCase() !== "real") return false;
  try {
    const ops = await ensureChainReady(log);
    setSettlement(createRealSettlement(ops));
    // Live on-chain feed (PRD FR-5.3): log every settlement event as anvil mines it.
    ops.watchEscrow((e) => {
      const id = typeof e.args.id === "string" ? e.args.id : "";
      log.info(`chain event ${e.eventName} id=${id} tx=${e.txHash} block=${e.blockNumber ?? "?"}`);
    });
    log.info("real-settlement: ENABLED (on-chain settlement active + event listener)");
    return true;
  } catch (err) {
    log.warn(`real-settlement: chain unavailable, staying on simulated settlement (${(err as Error).message})`);
    return false;
  }
}
