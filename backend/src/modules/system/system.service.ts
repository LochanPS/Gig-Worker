// What the backend is actually doing when it "settles".
//
// Until now nothing exposed this. In simulated mode every tx hash is random bytes;
// in real mode they are chain transactions you can open on an explorer — and the
// UI rendered both identically, so a fabricated hash was indistinguishable from a
// real one. Worse, enableRealSettlement() falls back to simulated on any chain
// error (risk R1), so the app could silently be simulating when the operator
// believed it was live. This module records what really happened at boot and
// serves it, so the interface can say which.
import { chainMetaFor, type SystemInfo } from '@gigbridge/shared';

interface SettlementState {
  active: 'real' | 'simulated';
  /** SETTLEMENT_MODE=real was asked for, but the chain was unreachable at boot. */
  degraded: boolean;
  contracts: Record<string, string> | null;
}

// Simulated until enableRealSettlement() says otherwise — the same default the
// settlement port itself uses.
let state: SettlementState = { active: 'simulated', degraded: false, contracts: null };

export function recordSettlement(next: SettlementState): void {
  state = next;
}

export function getSystemInfo(): SystemInfo {
  const chainId = Number(process.env.CHAIN_ID ?? 31337);
  const meta = chainMetaFor(chainId);
  return {
    settlementMode: state.active,
    degraded: state.degraded,
    chainId,
    chainName: meta.name,
    explorerUrl: meta.explorerUrl,
    // Only meaningful when transactions are real; simulated mode touches no contracts.
    contracts: state.active === 'real' ? state.contracts : null,
  };
}
