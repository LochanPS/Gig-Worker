import { ComposedChart } from '../composed-chart';
import { SeriesBar } from '../series-bar';
import { Line } from '../line';
import { Grid } from '../grid';

// Fee revenue as bars against escrow balance as a line, over time.
export function TreasuryComposed({
  data,
  height = 280,
}: {
  data: Record<string, unknown>[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ComposedChart
        data={data}
        xDataKey="date"
        margin={{ top: 16, right: 20, bottom: 26, left: 52 }}
        aspectRatio="5 / 2"
      >
        <Grid />
        <SeriesBar dataKey="revenue" fill="var(--chart-1)" />
        <Line dataKey="escrow" yAxisId="right" stroke="var(--chart-3)" strokeWidth={2} />
      </ComposedChart>
    </div>
  );
}
