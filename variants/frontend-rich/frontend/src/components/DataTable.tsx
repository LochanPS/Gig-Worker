import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
  width?: string;
}

export function DataTable<T>({
  columns,
  rows,
  onRowClick,
  rowKey,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  empty?: ReactNode;
}) {
  if (!rows.length && empty) return <>{empty}</>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={{ width: c.width }}
                className={cn(
                  'label h-9 px-4 font-normal',
                  c.align === 'right' ? 'text-right' : 'text-left',
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              className={cn(
                'border-b border-line h-11 transition-colors',
                onRowClick && 'hover:bg-raised focus:bg-raised focus:outline-none cursor-pointer',
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn('px-4 text-[13px]', c.align === 'right' ? 'text-right' : 'text-left')}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
