import { PieChart } from '../pie-chart';
import { PieSlice } from '../pie-slice';
import { PieCenter } from '../pie-center';

export interface DonutDatum {
  label: string;
  value: number;
  color?: string;
}

// Brand + semantic hues only, never rainbow.
const PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

export function DonutChart({
  data,
  size = 200,
  centerLabel = 'Total',
}: {
  data: DonutDatum[];
  size?: number;
  centerLabel?: string;
}) {
  const pieData = data.map((d, i) => ({ ...d, color: d.color ?? PALETTE[i % PALETTE.length] }));
  return (
    <PieChart data={pieData} size={size} innerRadius={size * 0.32} padAngle={0.02}>
      {pieData.map((_, i) => (
        <PieSlice key={i} index={i} />
      ))}
      <PieCenter defaultLabel={centerLabel} />
    </PieChart>
  );
}
