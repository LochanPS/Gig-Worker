// The chains this platform can settle on, and where to look a transaction up.
//
// Shared because both sides need the same answer: the backend reports which chain
// it is actually settling on (GET /system/info), and the frontend turns tx hashes
// into explorer links. Keeping one table stops the two drifting apart and showing
// a link to the wrong explorer.
export interface ChainMeta {
  id: number;
  name: string;
  explorerUrl: string | null; // null = no public explorer (a local dev chain)
  nativeSymbol: string;
}

export const CHAINS: Record<number, ChainMeta> = {
  31337: { id: 31337, name: 'Local Anvil', explorerUrl: null, nativeSymbol: 'ETH' },
  11155111: { id: 11155111, name: 'Ethereum Sepolia', explorerUrl: 'https://sepolia.etherscan.io', nativeSymbol: 'ETH' },
  84532: { id: 84532, name: 'Base Sepolia', explorerUrl: 'https://sepolia.basescan.org', nativeSymbol: 'ETH' },
  80002: { id: 80002, name: 'Polygon Amoy', explorerUrl: 'https://amoy.polygonscan.com', nativeSymbol: 'POL' },
};

export function chainMetaFor(id: number): ChainMeta {
  return CHAINS[id] ?? { id, name: `Chain ${id}`, explorerUrl: null, nativeSymbol: 'ETH' };
}
