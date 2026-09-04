import { cn } from '@/lib/utils';

// Segmented control: a row of bordered options, one active. No pill shapes.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('inline-flex border border-line divide-x divide-line', className)} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-7 px-2.5 text-[12px] transition-colors duration-150',
              active ? 'bg-raised text-text' : 'text-muted hover:text-text',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
