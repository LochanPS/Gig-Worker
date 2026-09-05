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
import { recordSettlement } from "../system/system.service.js";

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

function hexKey(k: string): Hex {
  return (k.startsWith("0x") ? k : `0x${k}`) as Hex;
}

/**
 * The on-chain identity of a party.
 *
 * walletAddress is now the truth: every wallet is written through lib/wallet.ts,
 * which guarantees the stored address IS the address of the stored key, and an
 * operator can supply a real testnet account when creating a customer. So the
 * address the UI shows is the address the money moves to.
 *
 * The key-derived address remains the fallback for rows written before that
 * invariant existed (the old seed minted address and key as independent randoms).
 * Deriving from the key is the safe side of that disagreement: the key is what can
 * actually sign, so a legacy payer stays able to fund.
 */
function onChainAddress(u: { walletAddress: string | null; walletKey: string | null }): Address {
  if (u.walletAddress) return u.walletAddress as Address;
  if (u.walletKey) return privateKeyToAccount(hexKey(u.walletKey)).address;
  throw new Error("real-settlement: party has no settlement wallet");
}

export interface SettlementParty {
  walletAddress: string | null;
  walletKey: string | null;
}

/**
 * Resolve the two accounts a funding transaction needs. Pure, so the asymmetry
 * between them is pinned by tests rather than only discovered against a chain:
 *
 *   payer — must be able to SIGN, so it needs a key. An account supplied as an
 *           address alone is receive-only, and is refused HERE with an
 *           actionable message instead of deep inside an RPC call.
 *   payee — only has to RECEIVE, so an address with no key is entirely valid.
 *           That is the point of letting an operator paste in a wallet they
 *           control without surrendering its key.
 *
 * The address the orchestrator passes is cross-checked against the payee's own
 * account, so the two can never silently disagree about where money is going.
 */
export function settlementParties(
  company: SettlementParty,
  freelancer: SettlementParty,
  passedPayeeWallet?: string,
): { payerKey: string; payee: Address } {
  if (!company.walletKey) {
    throw new Error(
      "real-settlement: the payer has no settlement key, so it cannot sign a funding transaction. " +
        "Its wallet was supplied as an address only, which can receive value but not spend it — " +
        "add the account's private key to pay from it.",
    );
  }
  const payee = onChainAddress(freelancer);
  // '0xpayee' is the historical placeholder from when settlement ignored this
  // argument entirely; it means "no opinion", not a real address.
  if (passedPayeeWallet && passedPayeeWallet !== "0xpayee" && passedPayeeWallet.toLowerCase() !== payee.toLowerCase()) {
    throw new Error(
      `real-settlement: payee wallet mismatch — orchestrator passed ${passedPayeeWallet} but the payee's account is ${payee}`,
    );
  }
  return { payerKey: company.walletKey, payee };
}

/** Build the port adapter over the chain ops. */
export function createRealSettlement(ops: ChainOps): Settlement {
  return {
    async fund(paymentId, payeeWallet, amountMinor, feeMinor, complianceHash): Promise<FundResult> {
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: { company: true, freelancer: true },
      });
      const { payerKey, payee } = settlementParties(payment.company, payment.freelancer, payeeWallet);

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

  // Every party with a settlement wallet, not only those the platform holds a key
  // for: a payee whose address an operator supplied has no key, and it still has to
  // be registered in the IdentityRegistry or EscrowVault.fund() rejects the payment
  // at its verified-party gate.
  const users = await prisma.user.findMany({
    where: { walletAddress: { not: null } },
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
    if (!verified || !u.walletAddress) continue;
    const wallet = onChainAddress(u);

    // Gas is only useful to an account that can sign; a receive-only payee never
    // sends a transaction, so topping it up would just burn the faucet.
    if (isLocal && u.walletKey && (await ops.ethBalance(wallet)) < GAS_FLOOR) {
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
  if ((process.env.SETTLEMENT_MODE ?? "simulated").toLowerCase() !== "real") {
    recordSettlement({ active: "simulated", degraded: false, contracts: null });
    return false;
  }
  try {
    const ops = await ensureChainReady(log);
    setSettlement(createRealSettlement(ops));
    // Publish what is actually in force, so the UI can label tx hashes as real
    // rather than leaving every hash ambiguous.
    const { MockUSDC, IdentityRegistry, EscrowVault, AuditAnchor } = ops.addresses;
    recordSettlement({
      active: "real",
      degraded: false,
      contracts: { MockUSDC, IdentityRegistry, EscrowVault, AuditAnchor },
    });
    // Live on-chain feed (PRD FR-5.3): log every settlement event as anvil mines it.
    ops.watchEscrow((e) => {
      const id = typeof e.args.id === "string" ? e.args.id : "";
      log.info(`chain event ${e.eventName} id=${id} tx=${e.txHash} block=${e.blockNumber ?? "?"}`);
    });
    log.info("real-settlement: ENABLED (on-chain settlement active + event listener)");
    return true;
  } catch (err) {
    // Real settlement was requested and could not be delivered. Recording this as
    // DEGRADED (rather than a plain "simulated") is the difference between the UI
    // saying "this demo simulates settlement" and an operator believing their
    // payments went on-chain when they did not.
    recordSettlement({ active: "simulated", degraded: true, contracts: null });
    log.warn(`real-settlement: chain unavailable, staying on simulated settlement (${(err as Error).message})`);
    return false;
  }
}
