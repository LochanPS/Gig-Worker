// Live settlement facts, fetched once and shared by every page that renders a
// transaction hash or a wallet address.
//
// Why this exists: the app renders `txHashFund` identically whether it is a real
// Base Sepolia transaction or 32 random bytes from the simulated settlement port,
// and the backend silently falls back to simulated when the chain is unreachable.
// Without this, nothing in the interface could tell you which you were looking at.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SystemInfo } from '@gigbridge/shared';
import { api } from './api.js';
import { useAuth } from './auth.js';
import { activeChainId, chainMeta } from './chain.js';

const SystemCtx = createContext<SystemInfo | null>(null);

export function SystemProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  // /system/info requires a session, so this is keyed to the signed-in user rather
  // than fetched once at mount: on a fresh load the provider mounts before login,
  // and on a user switch the old answer would otherwise be kept. A failure must
  // never blank a dashboard — the pages fall back to the build-time chain and
  // simply say less.
  useEffect(() => {
    if (!user) { setInfo(null); return; }
    let live = true;
    api.systemInfo().then((i) => { if (live) setInfo(i); }).catch(() => { if (live) setInfo(null); });
    return () => { live = false; };
  }, [user?.id]);
  return <SystemCtx.Provider value={info}>{children}</SystemCtx.Provider>;
}

export const useSystemInfo = (): SystemInfo | null => useContext(SystemCtx);

/**
 * The chain to build explorer links against: what the backend is really settling
 * on, falling back to the build-time VITE_CHAIN_ID before /system/info lands.
 */
export function useChainId(): number {
  return useSystemInfo()?.chainId ?? activeChainId;
}

/** Explorer base for the live chain, or null when there is nothing to link to. */
export function useExplorer(): string | null {
  const info = useSystemInfo();
  if (info) return info.explorerUrl;
  return chainMeta().explorerUrl;
}

/**
 * Are the tx hashes on screen real chain transactions? Only true when the backend
 * says settlement is live — a simulated hash is never presented as linkable.
 */
export function useIsOnChain(): boolean {
  return useSystemInfo()?.settlementMode === 'real';
}
