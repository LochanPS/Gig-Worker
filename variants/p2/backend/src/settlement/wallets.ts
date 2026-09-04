// Demo custodial wallet generation. Uses viem when present; falls back to a
// deterministic-looking random keypair so signup works with no chain deps.
// DEMO ONLY — real deployments use non-custodial wallets (TRD 8).
import { randomBytes } from "node:crypto";

export interface DemoWallet {
  address: string;
  privateKey: string;
}

export function generateDemoWallet(): DemoWallet {
  try {
    // Lazy import so the backend does not hard-depend on viem at signup time.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { generatePrivateKey, privateKeyToAccount } = require("viem/accounts");
    const privateKey: string = generatePrivateKey();
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    return { address: account.address, privateKey };
  } catch {
    const privateKey = "0x" + randomBytes(32).toString("hex");
    const address = "0x" + randomBytes(20).toString("hex");
    return { address, privateKey };
  }
}
