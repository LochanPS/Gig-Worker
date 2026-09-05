// Active chain + block-explorer links for on-chain references (roadmap #7).
// The chain the app points at is set at BUILD time via VITE_CHAIN_ID:
//   31337 (default) = local anvil — no public explorer, tx hashes render as plain text.
//   11155111 = Ethereum Sepolia · 84532 = Base Sepolia · 80002 = Polygon Amoy.
// Set VITE_CHAIN_ID to the chain you deployed the contracts to, then explorer links
// light up wherever a tx hash or address is shown.
export interface ChainMeta {
  id: number;
  name: string;
  explorerUrl: string | null; // null = no public explorer (local)
  nativeSymbol: string;
}

const CHAINS: Record<number, ChainMeta> = {
  31337: { id: 31337, name: 'Local Anvil', explorerUrl: null, nativeSymbol: 'ETH' },
  11155111: { id: 11155111, name: 'Ethereum Sepolia', explorerUrl: 'https://sepolia.etherscan.io', nativeSymbol: 'ETH' },
  84532: { id: 84532, name: 'Base Sepolia', explorerUrl: 'https://sepolia.basescan.org', nativeSymbol: 'ETH' },
  80002: { id: 80002, name: 'Polygon Amoy', explorerUrl: 'https://amoy.polygonscan.com', nativeSymbol: 'POL' },
};

const rawEnv = import.meta.env as Record<string, string | undefined>;
export const activeChainId: number = Number(rawEnv.VITE_CHAIN_ID ?? 31337);

export function chainMeta(id: number = activeChainId): ChainMeta {
  return CHAINS[id] ?? { id, name: `Chain ${id}`, explorerUrl: null, nativeSymbol: 'ETH' };
}

export function explorerTx(hash: string, id: number = activeChainId): string | null {
  const m = chainMeta(id);
  return m.explorerUrl ? `${m.explorerUrl}/tx/${hash}` : null;
}

export function explorerAddress(addr: string, id: number = activeChainId): string | null {
  const m = chainMeta(id);
  return m.explorerUrl ? `${m.explorerUrl}/address/${addr}` : null;
}
