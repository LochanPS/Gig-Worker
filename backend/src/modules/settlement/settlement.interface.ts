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

// ---------------------------------------------------------------------------
// Observable settlement mode. SETTLEMENT_MODE=real is a REQUEST; whether it was
// granted is only known after the chain handshake, and on failure the backend may
// fall back to simulated. Simulated hashes look exactly like real ones, so the UI
// has to be told which it is or it will render a fake hash as an explorer link.
// ---------------------------------------------------------------------------
export type SettlementMode = 'real' | 'simulated';

export interface SettlementStatus {
  settlementMode: SettlementMode;
  chainId: number | null;
  addresses: Record<string, string> | null;
}

let status: SettlementStatus = { settlementMode: 'simulated', chainId: null, addresses: null };

export function setSettlementMode(
  mode: SettlementMode,
  chainId: number | null = null,
  // `object` rather than Record<string, unknown>: DeployedAddresses is a plain
  // interface with no index signature, so it would not be assignable otherwise.
  addresses: object | null = null,
): void {
  // Keep only the four contract addresses; the deployed-addresses record also
  // carries chainId, which would be redundant here.
  const addrs = addresses
    ? Object.fromEntries(
        Object.entries(addresses).filter((e): e is [string, string] => typeof e[1] === 'string'),
      )
    : null;
  status = { settlementMode: mode, chainId, addresses: addrs };
}

export function getSettlementStatus(): SettlementStatus {
  return status;
}
