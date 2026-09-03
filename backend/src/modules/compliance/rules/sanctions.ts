// Mock sanctions / watchlist (a tiny stand-in for OFAC SDN + UN/EU lists).
// Demo seed includes "SanctionedCo" so scenario 2 (REJECT) fires deterministically.
const WATCHLIST = ['sanctionedco', 'evilcorp', 'blockedentity ltd', 'redlist holdings'];

export function isSanctioned(name: string): boolean {
  const n = name.trim().toLowerCase();
  return WATCHLIST.some((w) => n === w || n.includes(w));
}

export const sanctionsList = [...WATCHLIST];
