// Settlement Service interface (TRD 4.7 / 8). The real viem implementation is
// delivered by the P1 chain track into backend/src/settlement/. Until it lands
// — or whenever no platform key / RPC is configured — the SimulatedSettlement
// below drives the pipeline with deterministic fake tx hashes so the whole
// payment lifecycle completes end-to-end offline.

export interface FundParams {
  escrowId: string;
  payerKey: string;
  payeeAddress: string;
  amountMinor: number;
  feeMinor: number;
  complianceHash: string;
}

export interface SettlementResult {
  txHash: string;
}

export interface SettlementService {
  readonly mode: "onchain" | "simulated";
  /** payer funds escrow after compliance approval + rate lock */
  fundEscrow(p: FundParams): Promise<SettlementResult>;
  /** payer or platform releases escrow -> payee receives amount-fee */
  releaseEscrow(escrowId: string): Promise<SettlementResult>;
  /** payer (pre-release) or platform (rejected compliance) refunds */
  refundEscrow(escrowId: string): Promise<SettlementResult>;
  /** anchor a compliance decision hash (AuditAnchor.sol) */
  anchorDecision(decisionHash: string): Promise<SettlementResult>;
  /** write a credential hash to IdentityRegistry */
  setCredential(address: string, hash: string, expiryUnix: number): Promise<SettlementResult>;
}
