import type { PaymentState } from '@gigbridge/shared';
import { cn } from '@/lib/utils';

// Bordered pill. No fill except the two terminal states. No dot. No left strip.
// Only the two genuinely transient states animate.
const STYLE: Record<PaymentState, { cls: string; pulse?: boolean; strike?: boolean }> = {
  DRAFT: { cls: 'border-faint text-faint' },
  COMPLIANCE_CHECK: { cls: 'border-info text-info', pulse: true },
  FLAGGED: { cls: 'border-warn text-warn' },
  REJECTED: { cls: 'border-danger text-danger bg-danger/8' },
  RATE_LOCKED: { cls: 'border-info text-info' },
  FUNDED: { cls: 'border-ok text-ok' },
  SETTLING: { cls: 'border-ok text-ok', pulse: true },
  COMPLETED: { cls: 'border-ok text-ok bg-ok/12' },
  REFUNDED: { cls: 'border-muted text-muted' },
  EXPIRED: { cls: 'border-faint text-faint', strike: true },
};

const LABEL: Record<PaymentState, string> = {
  DRAFT: 'Draft',
  COMPLIANCE_CHECK: 'Compliance',
  FLAGGED: 'Flagged',
  REJECTED: 'Rejected',
  RATE_LOCKED: 'Rate locked',
  FUNDED: 'Funded',
  SETTLING: 'Settling',
  COMPLETED: 'Completed',
  REFUNDED: 'Refunded',
  EXPIRED: 'Expired',
};

export function StatusChip({ state, className }: { state: PaymentState; className?: string }) {
  const s = STYLE[state] ?? STYLE.DRAFT;
  return (
    <span
      className={cn(
        'inline-flex items-center h-[22px] px-2 border text-[11px] uppercase tracking-[0.06em] whitespace-nowrap',
        s.cls,
        s.pulse && 'chip-pulse',
        s.strike && 'line-through',
        className,
      )}
    >
      {LABEL[state] ?? state}
    </span>
  );
}

export function SeverityChip({ severity }: { severity: string }) {
  const cls =
    severity === 'HIGH' ? 'border-danger text-danger'
    : severity === 'MEDIUM' ? 'border-warn text-warn'
    : 'border-muted text-muted';
  return (
    <span className={cn('inline-flex items-center h-[22px] px-2 border text-[11px] uppercase tracking-[0.06em]', cls)}>
      {severity}
    </span>
  );
}

export function VerifiedChip({ status }: { status: string }) {
  const cls =
    status === 'VERIFIED' ? 'border-ok text-ok'
    : status === 'REJECTED' ? 'border-danger text-danger'
    : 'border-warn text-warn';
  const label = status === 'VERIFIED' ? 'Verified' : status === 'REJECTED' ? 'Rejected' : 'Pending';
  return (
    <span className={cn('inline-flex items-center h-[22px] px-2 border text-[11px] uppercase tracking-[0.06em]', cls)}>
      {label}
    </span>
  );
}
