import { AreaChart } from '../area-chart';
import { Area } from '../area';
import { Grid } from '../grid';
import { XAxis } from '../x-axis';
import { ChartTooltip } from '../tooltip/chart-tooltip';

export function CorridorChart({
  data,
  height = 260,
  dataKey = 'rate',
  axes = false,
  valueLabel = 'Rate',
  valueFormat,
}: {
  data: Record<string, unknown>[];
  height?: number;
  dataKey?: string;
  axes?: boolean;
  valueLabel?: string;
  valueFormat?: (n: number) => string;
}) {
  const fmt = valueFormat ?? ((n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 4 }));
  return (
    <div style={{ height }}>
      <AreaChart
        data={data}
        xDataKey="date"
        margin={{ top: 16, right: 12, bottom: axes ? 28 : 24, left: 44 }}
        style={{ height }}
        aspectRatio="auto"
      >
        <Grid />
        <Area dataKey={dataKey} stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.16} strokeWidth={1.5} />
        {axes ? <XAxis /> : null}
        <ChartTooltip rows={(point) => [{ color: 'var(--chart-1)', label: valueLabel, value: fmt(Number(point[dataKey] ?? 0)) }]} />
      </AreaChart>
    </div>
  );
}
