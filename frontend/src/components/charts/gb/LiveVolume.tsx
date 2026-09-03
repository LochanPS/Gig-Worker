import type { CSSProperties } from 'react';
import { LiveLineChart, type LiveLinePoint } from '../live-line-chart';
import { LiveLine } from '../live-line';
import { LiveXAxis } from '../live-x-axis';
import { LiveYAxis } from '../live-y-axis';
import { Grid } from '../grid';

// Streaming settlement volume. Value interpolates toward the latest tick, never snaps.
export function LiveVolume({
  data,
  value,
  height = 220,
}: {
  data: LiveLinePoint[];
  value: number;
  height?: number;
}) {
  const style: CSSProperties = { height };
  return (
    <div style={style}>
      <LiveLineChart data={data} value={value} window={30} margin={{ top: 16, right: 16, bottom: 26, left: 48 }} style={style}>
        <Grid />
        <LiveYAxis />
        <LiveXAxis />
        <LiveLine dataKey="value" stroke="var(--chart-1)" />
      </LiveLineChart>
    </div>
  );
}
