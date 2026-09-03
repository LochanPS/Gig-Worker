// Settlement port. Step 3 ships a SIMULATED implementation so the full payment
// lifecycle works end-to-end without a chain. P1 (track/chain) provides the real
// viem-backed implementation with the SAME interface and swaps it in on Day 2.
import { randomBytes } from 'node:crypto';

export interface FundResult {
  txHash: string;
  escrowId: string;
}

export interface Settlement {
  fund(paymentId: string, payeeWallet: string, amountMinor: number, feeMinor: number, complianceHash: string): Promise<FundResult>;
  release(escrowId: string): Promise<{ txHash: string }>;
  refund(escrowId: string): Promise<{ txHash: string }>;
  anchorDecision(hash: string): Promise<{ txHash: string }>;
}

const fakeTx = () => '0x' + randomBytes(32).toString('hex');
const fakeId = () => '0x' + randomBytes(16).toString('hex');

// Simulated settlement — deterministic-looking hashes, no external calls.
// Honest in the pitch as the fallback path (ROADMAP risk R1).
export const simulatedSettlement: Settlement = {
  async fund() {
    return { txHash: fakeTx(), escrowId: fakeId() };
  },
  async release() {
    return { txHash: fakeTx() };
  },
  async refund() {
    return { txHash: fakeTx() };
  },
  async anchorDecision() {
    return { txHash: fakeTx() };
  },
};

// Swapped by P1's real implementation via setSettlement() on Day 2.
let active: Settlement = simulatedSettlement;
export const getSettlement = (): Settlement => active;
export const setSettlement = (s: Settlement): void => {
  active = s;
};
