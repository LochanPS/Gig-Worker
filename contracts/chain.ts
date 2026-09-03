/**
 * Low-level viem chain operations for GigBridge — no database, no backend types.
 * The backend's real-settlement adapter (backend/src/modules/settlement) calls
 * these; keeping them here means all viem/ABI wiring lives with the contracts.
 *
 * ABIs + bytecode are read from the committed shared/abis/*.json so this needs
 * no Foundry toolchain at runtime.
 */
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  keccak256,
  toBytes,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAddresses, type DeployedAddresses } from "./deploy.js";

const here = dirname(fileURLToPath(import.meta.url));
const abisDir = resolve(here, "..", "shared", "abis");

/** Anvil account 0 — well-known dev key. DEMO ONLY. Deployer + platform + owner. */
const DEFAULT_KEY: Hex = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const DEFAULT_RPC = "http://127.0.0.1:8545";
const DEFAULT_CHAIN_ID = 31337;

/** Minor units (1/100) -> MockUSDC base units (6 decimals): x10^4. */
export const MINOR_TO_USDC = 10_000n;
export function minorToUsdc(minor: number | bigint): bigint {
  return BigInt(minor) * MINOR_TO_USDC;
}

function abiOf(name: string): Abi {
  return JSON.parse(readFileSync(resolve(abisDir, `${name}.json`), "utf8")).abi as Abi;
}
const ESCROW_ABI = abiOf("EscrowVault");
const USDC_ABI = abiOf("MockUSDC");
const REGISTRY_ABI = abiOf("IdentityRegistry");
const AUDIT_ABI = abiOf("AuditAnchor");

function hexKey(k: string): Hex {
  return (k.startsWith("0x") ? k : `0x${k}`) as Hex;
}

/** Derive the on-chain escrow id from a payment uuid (keccak256 of its utf8 bytes). */
export function escrowIdFor(paymentId: string): Hex {
  return keccak256(toBytes(paymentId));
}

export interface ChainOpsOptions {
  addresses?: DeployedAddresses;
  rpcUrl?: string;
  chainId?: number;
  /** platform/owner key: has PLATFORM_ROLE, is token + registry owner. */
  platformKey?: string;
}

export function createChainOps(opts: ChainOpsOptions = {}) {
  const rpcUrl = opts.rpcUrl ?? process.env.RPC_URL ?? DEFAULT_RPC;
  const chainId = opts.chainId ?? Number(process.env.CHAIN_ID ?? DEFAULT_CHAIN_ID);
  const addresses = opts.addresses ?? loadAddresses(chainId);
  if (!addresses) throw new Error("chain: no deployed addresses — run ensureDeployed() first");

  const chain = defineChain({
    id: chainId,
    name: "gigbridge-local",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });

  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const platformAccount = privateKeyToAccount(hexKey(opts.platformKey ?? process.env.PLATFORM_PRIVATE_KEY ?? DEFAULT_KEY));
  const platform = createWalletClient({ account: platformAccount, chain, transport: http(rpcUrl) });
  const walletFor = (key: string) =>
    createWalletClient({ account: privateKeyToAccount(hexKey(key)), chain, transport: http(rpcUrl) });

  const escrow = getAddress(addresses.EscrowVault);
  const usdc = getAddress(addresses.MockUSDC);
  const registry = getAddress(addresses.IdentityRegistry);
  const audit = getAddress(addresses.AuditAnchor);

  async function wait(hash: Hex): Promise<Hex> {
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  return {
    addresses,
    escrowIdFor,
    minorToUsdc,

    async isVerified(subject: Address): Promise<boolean> {
      return publicClient.readContract({ address: registry, abi: REGISTRY_ABI, functionName: "isVerified", args: [subject] }) as Promise<boolean>;
    },

    async usdcBalance(addr: Address): Promise<bigint> {
      return publicClient.readContract({ address: usdc, abi: USDC_ABI, functionName: "balanceOf", args: [addr] }) as Promise<bigint>;
    },

    async ethBalance(addr: Address): Promise<bigint> {
      return publicClient.getBalance({ address: addr });
    },

    /** Send gas (ETH) from the platform to a demo wallet so it can sign txs. */
    async sendGas(to: Address, valueWei: bigint): Promise<Hex> {
      return wait(await platform.sendTransaction({ to, value: valueWei }));
    },

    /** Owner-only faucet: mint MockUSDC (base units) to an address. */
    async mintUsdc(to: Address, baseUnits: bigint): Promise<Hex> {
      return wait(await platform.writeContract({ address: usdc, abi: USDC_ABI, functionName: "mint", args: [to, baseUnits] }));
    },

    /** Owner-only: attest a credential hash so isVerified(subject) is true. */
    async setCredential(subject: Address, hash: Hex, expiry: bigint): Promise<Hex> {
      return wait(await platform.writeContract({ address: registry, abi: REGISTRY_ABI, functionName: "setCredential", args: [subject, hash, expiry] }));
    },

    /**
     * Payer funds escrow: approve MockUSDC then EscrowVault.fund. Signed with the
     * payer's (demo) key — the payer must be gas-funded, verified, and hold USDC.
     */
    async fund(payerKey: string, escrowId: Hex, payee: Address, amount: bigint, fee: bigint, complianceHash: Hex): Promise<Hex> {
      const payer = walletFor(payerKey);
      await wait(await payer.writeContract({ address: usdc, abi: USDC_ABI, functionName: "approve", args: [escrow, amount] }));
      return wait(await payer.writeContract({ address: escrow, abi: ESCROW_ABI, functionName: "fund", args: [escrowId, payee, amount, fee, complianceHash] }));
    },

    /** Platform release: payee gets amount-fee, treasury gets fee. */
    async release(escrowId: Hex): Promise<Hex> {
      return wait(await platform.writeContract({ address: escrow, abi: ESCROW_ABI, functionName: "release", args: [escrowId] }));
    },

    /** Platform refund: full amount back to payer. */
    async refund(escrowId: Hex): Promise<Hex> {
      return wait(await platform.writeContract({ address: escrow, abi: ESCROW_ABI, functionName: "refund", args: [escrowId] }));
    },

    /** Anchor a compliance-decision hash on AuditAnchor. */
    async anchor(hash: Hex): Promise<Hex> {
      return wait(await platform.writeContract({ address: audit, abi: AUDIT_ABI, functionName: "anchor", args: [hash] }));
    },

    async getPayment(escrowId: Hex) {
      return publicClient.readContract({ address: escrow, abi: ESCROW_ABI, functionName: "getPayment", args: [escrowId] });
    },

    /**
     * Watch EscrowVault settlement events live (PaymentFunded/Released/Refunded/
     * Frozen). Polls (anvil-friendly). Returns an unwatch function. This is the
     * on-chain source of truth for the live tx feed (PRD FR-5.3).
     */
    watchEscrow(
      onEvent: (e: { eventName: string; args: Record<string, unknown>; txHash: Hex; blockNumber: bigint | null }) => void,
    ): () => void {
      return publicClient.watchContractEvent({
        address: escrow,
        abi: ESCROW_ABI,
        pollingInterval: 500,
        onLogs: (logs) => {
          for (const l of logs) {
            const log = l as unknown as { eventName: string; args: Record<string, unknown>; transactionHash: Hex; blockNumber: bigint | null };
            onEvent({ eventName: log.eventName, args: log.args, txHash: log.transactionHash, blockNumber: log.blockNumber });
          }
        },
      });
    },
  };
}

export type ChainOps = ReturnType<typeof createChainOps>;
