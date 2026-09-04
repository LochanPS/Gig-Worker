import type { ReactNode } from 'react';
import { Button } from './primitives';

export function Loading({ what }: { what: string }) {
  return (
    <div className="flex items-center justify-center py-14 text-[13px] text-muted">Loading {what}</div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <h3 className="text-[15px] text-text">{title}</h3>
      <p className="text-[13px] text-muted max-w-[46ch]">{body}</p>
      {action ? (
        <Button variant="default" size="sm" onClick={action.onClick} className="mt-1">
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 px-6 text-center">
      <p className="text-[13px] text-danger max-w-[52ch]">{message}</p>
      {onRetry ? (
        <Button variant="default" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

/** Determinate bar that holds a statistic panel's layout while the figure loads. */
export function ValuePending() {
  return <div className="h-[30px] flex items-center"><div className="h-[2px] w-16 bg-line-strong" /></div>;
}

export function Async<T>({
  state,
  what,
  empty,
  onRetry,
  children,
}: {
  state: { data: T | null; loading: boolean; error: string | null };
  what: string;
  empty?: { title: string; body: string; action?: { label: string; onClick: () => void } };
  onRetry?: () => void;
  children: (data: T) => ReactNode;
}) {
  if (state.loading) return <Loading what={what} />;
  if (state.error) return <ErrorState message={state.error} onRetry={onRetry} />;
  if (!state.data) return null;
  if (Array.isArray(state.data) && state.data.length === 0 && empty)
    return <EmptyState {...empty} />;
  return <>{children(state.data)}</>;
}
