// A transaction / address reference that becomes a block-explorer link whenever
// the build points at a public chain (VITE_CHAIN_ID). On local anvil there is no
// explorer, so it degrades to plain monospace text rather than a dead link.
import { explorerTx, explorerAddress } from '../lib/chain.js';
import { useIsOnChain } from '../lib/meta.js';

interface Props {
  hash: string | null | undefined;
  kind?: 'tx' | 'address';
  /** Characters to show before the ellipsis; 0 shows the whole value. */
  truncate?: number;
  empty?: string;
}

export default function TxLink({ hash, kind = 'tx', truncate = 18, empty = '—' }: Props) {
  const onChain = useIsOnChain();
  if (!hash) return <span className="muted">{empty}</span>;
  const shown = truncate > 0 && hash.length > truncate ? `${hash.slice(0, truncate)}…` : hash;
  // In simulated mode the hash is random bytes: it would render a plausible-looking
  // explorer link that 404s. Show it as plain text and label it instead.
  if (!onChain) {
    return <span className="mono txlink sim" title={`${hash} (simulated — not on any chain)`}>{shown}</span>;
  }
  const url = kind === 'tx' ? explorerTx(hash) : explorerAddress(hash);
  if (!url) return <span className="mono txlink" title={hash}>{shown}</span>;
  return (
    <a className="mono txlink" href={url} target="_blank" rel="noopener noreferrer" title={hash}>
      {shown} ↗
    </a>
  );
}
