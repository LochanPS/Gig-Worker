import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-6 mb-7">
      <div>
        <h1 className="text-[34px] leading-[1.1] font-medium tracking-[-0.02em]">{title}</h1>
        {subtitle ? <p className="text-[13px] text-muted mt-1.5 max-w-[68ch]">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0 pb-1">{action}</div> : null}
    </header>
  );
}

/** Statistic row: figures separated by vertical hairlines, not four separate cards. */
export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="border border-line bg-surface grid grid-cols-2 md:grid-cols-4 divide-x divide-line [&>*]:border-line">
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  note,
  delta,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  delta?: { value: string; positive: boolean } | null;
}) {
  return (
    <div className="px-4 py-4 min-w-0">
      <div className="label mb-2">{label}</div>
      <div className="text-text">{value}</div>
      <div className="mt-1.5 flex items-center gap-2 min-h-[16px]">
        {delta ? (
          <span className={`num text-[11px] ${delta.positive ? 'text-ok' : 'text-muted'}`}>{delta.value}</span>
        ) : null}
        {note ? <span className="text-[11px] text-faint">{note}</span> : null}
      </div>
    </div>
  );
}
