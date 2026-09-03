// Small shared presentational bits.
export const money = (minor: number | null | undefined, ccy: string) =>
  minor == null ? '—' : `${ccy} ${(minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function Chip({ value }: { value: string }) {
  return <span className={`chip ${value}`}>{value}</span>;
}

export function Stat({ label, value, ghost }: { label: string; value: string; ghost?: string }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="val">{value}</div>
      {ghost && <div className="ghost">{ghost}</div>}
    </div>
  );
}
