import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { Currency } from '@gigbridge/shared';

const SIZES = {
  sm: 'text-[12px]',
  md: 'text-[13px]',
  lg: 'text-[20px]',
  xl: 'text-[26px]',
  hero: 'text-[46px] leading-[1.05]',
} as const;

export function Money({
  minor,
  currency,
  size = 'md',
  code = true,
  className,
}: {
  minor: number | null | undefined;
  currency: Currency | string;
  size?: keyof typeof SIZES;
  code?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('num', SIZES[size], className)}>{formatMoney(minor, currency, { code })}</span>
  );
}
