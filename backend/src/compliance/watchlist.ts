// Mock OFAC SDN list for the sanctions screen (US-OFAC-001). BUILD_CONTRACTS §7
// seeds "SanctionedCo" + one freelancer alias onto this list.
const SDN_NAMES = new Set(
  ["sanctionedco", "boris volkov", "red harbor trading", "uma rao (alias)"].map((s) =>
    s.toLowerCase().trim(),
  ),
);

export function isSanctioned(name: string): boolean {
  return SDN_NAMES.has(name.toLowerCase().trim());
}

export function addToWatchlist(name: string): void {
  SDN_NAMES.add(name.toLowerCase().trim());
}

export function watchlist(): string[] {
  return [...SDN_NAMES];
}
