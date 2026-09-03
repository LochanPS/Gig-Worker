import { BarChart } from '../bar-chart';
import { Bar } from '../bar';
import { Grid } from '../grid';

export function SimpleBars({
  data,
  dataKey,
  height = 240,
  color = 'var(--chart-1)',
  xDataKey = 'name',
}: {
  data: Record<string, unknown>[];
  dataKey: string;
  height?: number;
  color?: string;
  xDataKey?: string;
}) {
  return (
    <div style={{ height }}>
      <BarChart
        data={data}
        xDataKey={xDataKey}
        margin={{ top: 16, right: 12, bottom: 26, left: 44 }}
        aspectRatio={`${Math.round(height*2.2)} / ${height}`}
      >
        <Grid />
        <Bar dataKey={dataKey} fill={color} />
      </BarChart>
    </div>
  );
}
