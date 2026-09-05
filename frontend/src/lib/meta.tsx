// Whether the backend is REALLY settling on-chain right now, fetched from
// GET /api/v1/meta. This is deliberately not inferred from VITE_CHAIN_ID: that only
// says which chain the build points at, while the backend may have failed its chain
// handshake and fallen back to simulated settlement — which returns random 32-byte
// hashes indistinguishable from real ones. Everything that renders an on-chain
// reference reads this so a simulated hash never becomes a dead explorer link.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api.js';

export interface SettlementMeta {
  settlementMode: 'real' | 'simulated';
  chainId: number | null;
  addresses: Record<string, string> | null;
}

// Assume simulated until told otherwise — the safe default is to not link out.
const FALLBACK: SettlementMeta = { settlementMode: 'simulated', chainId: null, addresses: null };

const Ctx = createContext<SettlementMeta>(FALLBACK);

export function MetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<SettlementMeta>(FALLBACK);
  useEffect(() => {
    api.meta().then(setMeta).catch(() => setMeta(FALLBACK));
  }, []);
  return <Ctx.Provider value={meta}>{children}</Ctx.Provider>;
}

export function useMeta(): SettlementMeta {
  return useContext(Ctx);
}

/** True only when the backend confirms on-chain settlement is live. */
export function useIsOnChain(): boolean {
  return useMeta().settlementMode === 'real';
}
