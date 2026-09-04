// Environment configuration (BUILD_CONTRACTS.txt section 2). All numeric knobs
// have safe demo defaults so the backend boots with an empty .env.

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "true" || v === "1";
}

export const config = {
  port: num("PORT", 4000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-change-me",

  chain: {
    rpcUrl: process.env.RPC_URL ?? "http://localhost:8545",
    chainId: num("CHAIN_ID", 31337),
    platformPrivateKey: process.env.PLATFORM_PRIVATE_KEY ?? "",
    deployerPrivateKey: process.env.DEPLOYER_PRIVATE_KEY ?? "",
    treasuryAddress: process.env.TREASURY_ADDRESS ?? "",
    // Base URL for tx-hash explorer links (empty on local anvil).
    explorerBaseUrl: process.env.EXPLORER_BASE_URL ?? "",
    // Real on-chain settlement only when explicitly enabled AND a platform key
    // is present; otherwise simulated (deterministic fake tx hashes) so the
    // pipeline still completes offline.
    get mode(): "real" | "simulated" {
      return process.env.SETTLEMENT_MODE === "real" && !!process.env.PLATFORM_PRIVATE_KEY
        ? "real"
        : "simulated";
    },
    get simulated(): boolean {
      return this.mode === "simulated";
    },
  },

  agent: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
    get enabled(): boolean {
      return !!process.env.ANTHROPIC_API_KEY;
    },
  },

  fx: {
    apiUrl: process.env.FX_API_URL ?? "https://api.frankfurter.app",
    offline: bool("FX_OFFLINE", false),
  },

  fee: {
    bps: num("FEE_BPS", 75),
    minUsdMinor: num("FEE_MIN_USD", 1) * 100, // USD minor units
  },
  rateLockMinutes: num("RATE_LOCK_MINUTES", 10),

  credentialEncKey: process.env.CREDENTIAL_ENC_KEY ??
    "0".repeat(64),
} as const;

export type Config = typeof config;
