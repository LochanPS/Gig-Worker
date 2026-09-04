import { ComposedChart } from '../composed-chart';
import { SeriesBar } from '../series-bar';
import { Line } from '../line';
import { Grid } from '../grid';
import { ChartTooltip } from '../tooltip/chart-tooltip';
import { formatMoney } from '@/lib/money';

// Fee revenue as bars against escrow balance as a line, over time.
export function TreasuryComposed({
  data,
  height = 280,
}: {
  data: Record<string, unknown>[];
  height?: number;
}) {
  const usd = (n: number) => formatMoney(Math.round(n * 100), 'USD');
  return (
    <div style={{ height }}>
      <ComposedChart
        data={data}
        xDataKey="date"
        margin={{ top: 16, right: 20, bottom: 26, left: 52 }}
        aspectRatio="auto"
        style={{ height }}
      >
        <Grid />
        <SeriesBar dataKey="revenue" fill="var(--chart-1)" />
        <Line dataKey="escrow" yAxisId="right" stroke="var(--chart-3)" strokeWidth={2} />
        <ChartTooltip
          rows={(p) => [
            { color: 'var(--chart-1)', label: 'Fee revenue', value: usd(Number(p.revenue ?? 0)) },
            { color: 'var(--chart-3)', label: 'Escrow balance', value: usd(Number(p.escrow ?? 0)) },
          ]}
        />
      </ComposedChart>
    </div>
  );
}
