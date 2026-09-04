import { BarChart } from '../bar-chart';
import { Bar } from '../bar';
import { Grid } from '../grid';
import { ChartTooltip } from '../tooltip/chart-tooltip';

export function SimpleBars({
  data,
  dataKey,
  height = 240,
  color = 'var(--chart-1)',
  xDataKey = 'name',
  valueLabel = 'Value',
  valueFormat,
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  height?: number;
  color?: string;
  xDataKey?: string;
  valueLabel?: string;
  valueFormat?: (n: number) => string;
}) {
  const fmt = valueFormat ?? ((n: number) => n.toLocaleString('en-US'));
  return (
    <div style={{ height }}>
      <BarChart
        data={data}
        xDataKey={xDataKey}
        margin={{ top: 16, right: 12, bottom: 26, left: 44 }}
        aspectRatio="auto"
        style={{ height }}
      >
        <Grid />
        <Bar dataKey={dataKey} fill={color} />
        <ChartTooltip
          showDatePill={false}
          rows={(point) => [{ color, label: valueLabel, value: fmt(Number(point[dataKey] ?? 0)) }]}
        />
      </BarChart>
    </div>
  );
}
