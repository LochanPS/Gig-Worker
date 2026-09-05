// Active chain + block-explorer links for on-chain references (roadmap #7).
//
// The chain TABLE now lives in @gigbridge/shared, so the backend's /system/info
// and these links can never disagree about which explorer a chain uses.
//
// Which chain is active has two answers, and they differ in an important way:
//   - VITE_CHAIN_ID is a BUILD-time guess baked into the bundle.
//   - GET /system/info is what the backend is really settling on, right now.
// Prefer the live answer wherever it is available (see useSystemInfo); this
// build-time default is the fallback before that request lands.
import { chainMetaFor, type ChainMeta } from '@gigbridge/shared';

export type { ChainMeta };

const rawEnv = import.meta.env as Record<string, string | undefined>;
export const activeChainId: number = Number(rawEnv.VITE_CHAIN_ID ?? 31337);

export function chainMeta(id: number = activeChainId): ChainMeta {
  return chainMetaFor(id);
}

export function explorerTx(hash: string, id: number = activeChainId): string | null {
  const m = chainMeta(id);
  return m.explorerUrl ? `${m.explorerUrl}/tx/${hash}` : null;
}

export function explorerAddress(addr: string, id: number = activeChainId): string | null {
  const m = chainMeta(id);
  return m.explorerUrl ? `${m.explorerUrl}/address/${addr}` : null;
}

/** Short form for a 0x address or hash: 0x1234…cdef. */
export function shortHex(v: string, lead = 6, tail = 4): string {
  return v.length <= lead + tail + 1 ? v : `${v.slice(0, lead)}…${v.slice(-tail)}`;
}
