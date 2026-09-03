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
}: {
  data: Record<string, unknown>[];
  height?: number;
  dataKey?: string;
  axes?: boolean;
}) {
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
        {axes ? <ChartTooltip /> : null}
      </AreaChart>
    </div>
  );
}
