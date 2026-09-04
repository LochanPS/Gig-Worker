import { RingChart } from '../ring-chart';
import { Ring } from '../ring';
import { RingCenter } from '../ring-center';

// Share of payouts auto-converted to INR. The empty track reads as the held remainder.
export function RingSplit({
  convertedPct,
  size = 200,
}: {
  convertedPct: number;
  size?: number;
}) {
  const converted = Math.max(0, Math.min(100, Math.round(convertedPct)));
  const data = [{ label: 'Converted', value: converted, maxValue: 100, color: 'var(--chart-1)' }];
  return (
    <RingChart data={data} size={size} strokeWidth={14} baseInnerRadius={54}>
      <Ring index={0} />
      <RingCenter defaultLabel="Converted to INR" suffix="%" />
    </RingChart>
  );
}
