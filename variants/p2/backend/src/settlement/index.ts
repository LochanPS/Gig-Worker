import type { SettlementService } from "./interface.js";
import { SimulatedSettlement } from "./simulated.js";
import { OnchainSettlement } from "./onchain.js";
import { config } from "../lib/config.js";

// Factory: the on-chain viem driver when SETTLEMENT_MODE=real (and a platform
// key is present), else the simulated driver (deterministic fake tx hashes) so
// the payment lifecycle still completes offline. A single seam so swapping in
// real settlement is a config flip (TRD 8: "already an interface for exactly
// this reason").
let instance: SettlementService | null = null;

export function getSettlement(): SettlementService {
  if (instance) return instance;
  instance = config.chain.mode === "real" ? new OnchainSettlement() : new SimulatedSettlement();
  return instance;
}

export * from "./interface.js";
