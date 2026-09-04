import { Gauge } from '../gauge';

// Flagged rate against target. Copper below target, warn when the value crosses it.
export function GaugeChart({
  value,
  target = 5,
  max = 20,
  suffix = '%',
}: {
  value: number;
  target?: number;
  max?: number;
  suffix?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const over = value > target;
  return (
    <Gauge
      value={pct}
      centerValue={value}
      suffix={suffix}
      defaultLabel={over ? `Above ${target}${suffix} target` : `Target ${target}${suffix}`}
      activeFill={over ? 'var(--color-warn)' : 'var(--color-accent)'}
      inactiveFill="var(--color-line)"
      totalNotches={40}
      formatOptions={{ maximumFractionDigits: 1 }}
    />
  );
}
