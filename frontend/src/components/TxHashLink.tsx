import { useState } from 'react';
import { truncateHash } from '@/lib/format';

export function TxHashLink({ hash, explorer = 'http://localhost:8545' }: { hash: string; explorer?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <a
        href={`${explorer}/tx/${hash}`}
        target="_blank"
        rel="noreferrer"
        className="num text-[11px] text-info hover:text-text transition-colors underline underline-offset-2 decoration-line"
      >
        {truncateHash(hash)}
      </a>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(hash);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }}
        className="text-[11px] text-faint hover:text-text transition-colors"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

export function CopyValue({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="num text-[12px] text-text break-all">{label ?? value}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }}
        className="text-[11px] text-faint hover:text-text transition-colors shrink-0"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}
