/**
 * Deploy-on-boot for the four GigBridge contracts (TRD 3, BUILD_CONTRACTS §6).
 *
 * The backend imports `ensureDeployed()` and calls it at startup: if the chain
 * already has the contracts (address recorded + code present) it is a no-op,
 * otherwise it deploys all four to anvil and writes their addresses to
 * shared/abis/addresses.local.json (gitignored — runtime state).
 *
 * ABIs + bytecode come from the committed shared/abis/*.json, so this runs with
 * no Foundry toolchain in the container.
 */
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  type Abi,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const abisDir = resolve(here, "..", "shared", "abis");
const ADDRESSES_FILE = resolve(abisDir, "addresses.local.json");

/** Anvil account 0 — well-known dev key. DEMO ONLY, never a real key. */
const DEFAULT_DEPLOYER = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const DEFAULT_RPC = "http://127.0.0.1:8545";
const DEFAULT_CHAIN_ID = 31337;

export interface DeployedAddresses {
  chainId: number;
  MockUSDC: Address;
  IdentityRegistry: Address;
  EscrowVault: Address;
  AuditAnchor: Address;
  deployedAt: string;
}

interface Artifact {
  abi: Abi;
  bytecode: `0x${string}`;
}

function artifact(name: string): Artifact {
  const j = JSON.parse(readFileSync(resolve(abisDir, `${name}.json`), "utf8"));
  const bytecode: string = j.bytecode;
  return { abi: j.abi as Abi, bytecode: (bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`) as `0x${string}` };
}

function hexKey(k: string): `0x${string}` {
  return (k.startsWith("0x") ? k : `0x${k}`) as `0x${string}`;
}

function localChain(chainId: number, rpcUrl: string) {
  return defineChain({
    id: chainId,
    name: "gigbridge-local",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

export function loadAddresses(): DeployedAddresses | null {
  try {
    return JSON.parse(readFileSync(ADDRESSES_FILE, "utf8")) as DeployedAddresses;
  } catch {
    return null;
  }
}

export interface DeployOpts {
  rpcUrl?: string;
  chainId?: number;
  deployerKey?: string;
  /** fee-collection address; defaults to the deployer. */
  treasury?: string;
}

/** Deploy all four contracts unconditionally and record their addresses. */
export async function deployContracts(opts: DeployOpts = {}): Promise<DeployedAddresses> {
  const rpcUrl = opts.rpcUrl ?? process.env.RPC_URL ?? DEFAULT_RPC;
  const chainId = opts.chainId ?? Number(process.env.CHAIN_ID ?? DEFAULT_CHAIN_ID);
  const account = privateKeyToAccount(hexKey(opts.deployerKey ?? process.env.DEPLOYER_PRIVATE_KEY ?? DEFAULT_DEPLOYER));
  const chain = localChain(chainId, rpcUrl);

  const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
  const pub = createPublicClient({ chain, transport: http(rpcUrl) });
  const treasury = getAddress(opts.treasury ?? process.env.TREASURY_ADDRESS ?? account.address);

  async function deploy(name: string, args: readonly unknown[] = []): Promise<Address> {
    const { abi, bytecode } = artifact(name);
    const hash = await wallet.deployContract({ abi, bytecode, args });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) throw new Error(`${name}: deployment receipt has no contractAddress`);
    return receipt.contractAddress;
  }

  const mockUsdc = await deploy("MockUSDC");
  const registry = await deploy("IdentityRegistry");
  const auditAnchor = await deploy("AuditAnchor");
  // EscrowVault(token, registry, treasury, admin)
  const escrowVault = await deploy("EscrowVault", [mockUsdc, registry, treasury, account.address]);

  const addresses: DeployedAddresses = {
    chainId,
    MockUSDC: mockUsdc,
    IdentityRegistry: registry,
    EscrowVault: escrowVault,
    AuditAnchor: auditAnchor,
    deployedAt: new Date().toISOString(),
  };
  writeFileSync(ADDRESSES_FILE, JSON.stringify(addresses, null, 2) + "\n");
  return addresses;
}

/** Deploy only if not already live: reuse recorded addresses when code exists. */
export async function ensureDeployed(opts: DeployOpts = {}): Promise<DeployedAddresses> {
  const rpcUrl = opts.rpcUrl ?? process.env.RPC_URL ?? DEFAULT_RPC;
  const chainId = opts.chainId ?? Number(process.env.CHAIN_ID ?? DEFAULT_CHAIN_ID);
  const existing = loadAddresses();
  if (existing && existing.chainId === chainId) {
    const pub = createPublicClient({ chain: localChain(chainId, rpcUrl), transport: http(rpcUrl) });
    const code = await pub.getCode({ address: existing.EscrowVault });
    if (code && code !== "0x") return existing;
  }
  return deployContracts(opts);
}

// CLI entry: `pnpm --filter @gigbridge/contracts deploy:local`
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("deploy.ts")) {
  ensureDeployed()
    .then((a) => {
      console.log("GigBridge contracts deployed:");
      console.log(JSON.stringify(a, null, 2));
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
