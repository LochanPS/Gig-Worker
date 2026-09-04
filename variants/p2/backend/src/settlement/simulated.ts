import { createHash } from "node:crypto";
import type {
  SettlementService,
  FundParams,
  SettlementResult,
} from "./interface.js";

// Deterministic fake tx hash so the same action always yields the same hash
// (nice for demos + tests). Matches the risk-register fallback R1.
function fakeTxHash(...parts: string[]): string {
  return "0x" + createHash("sha256").update(parts.join("|")).digest("hex");
}

export class SimulatedSettlement implements SettlementService {
  readonly mode = "simulated" as const;

  async fundEscrow(p: FundParams): Promise<SettlementResult> {
    return { txHash: fakeTxHash("fund", p.escrowId, String(p.amountMinor)) };
  }
  async releaseEscrow(escrowId: string): Promise<SettlementResult> {
    return { txHash: fakeTxHash("release", escrowId) };
  }
  async refundEscrow(escrowId: string): Promise<SettlementResult> {
    return { txHash: fakeTxHash("refund", escrowId) };
  }
  async anchorDecision(decisionHash: string): Promise<SettlementResult> {
    return { txHash: fakeTxHash("anchor", decisionHash) };
  }
  async setCredential(address: string, hash: string, expiryUnix: number): Promise<SettlementResult> {
    return { txHash: fakeTxHash("credential", address, hash, String(expiryUnix)) };
  }
  async provisionPayer(_address: string, _usdcMinor: number): Promise<void> {
    // No chain to fund in simulated mode.
  }
}
