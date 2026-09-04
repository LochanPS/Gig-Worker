import type { SettlementService } from "./interface.js";
import { SimulatedSettlement } from "./simulated.js";
import { config } from "../lib/config.js";

// Factory: returns the on-chain viem implementation once P1's module is wired
// (backend/src/settlement/onchain.ts) and a platform key is present; otherwise
// the simulated driver. Kept as a single seam so swapping in real settlement
// is a one-line change (TRD 8: "already an interface for exactly this reason").
let instance: SettlementService | null = null;

export function getSettlement(): SettlementService {
  if (instance) return instance;
  if (!config.chain.simulated) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { OnchainSettlement } = require("./onchain.js");
      instance = new OnchainSettlement();
      return instance!;
    } catch {
      // P1 module not present yet — fall through to simulated.
    }
  }
  instance = new SimulatedSettlement();
  return instance;
}

export * from "./interface.js";
