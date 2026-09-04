export function truncateHash(hash: string | null | undefined, lead = 6, tail = 4): string {
  if (!hash) return '-';
  if (hash.length <= lead + tail + 2) return hash;
  return `${hash.slice(0, lead)}...${hash.slice(-tail)}`;
}

export function truncateDid(did: string | null | undefined): string {
  if (!did) return '-';
  return did.length > 32 ? `${did.slice(0, 24)}...${did.slice(-6)}` : did;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

export function relativeAge(iso: string | null | undefined): string {
  if (!iso) return '-';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

export function countryName(code: string): string {
  const names: Record<string, string> = {
    DE: 'Germany', IN: 'India', US: 'United States', GB: 'United Kingdom',
    FR: 'France', NL: 'Netherlands', SG: 'Singapore', AE: 'United Arab Emirates',
  };
  return names[code] ?? code;
}
