import { HeatmapChart } from '../heatmap/heatmap-chart';
import { HeatmapCells } from '../heatmap/heatmap-cells';
import { HeatmapXAxis } from '../heatmap/heatmap-x-axis';
import { HeatmapYAxis } from '../heatmap/heatmap-y-axis';
import type { HeatmapColumn } from '../heatmap/heatmap-context';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Payment volume by day over the trailing weeks. Columns are weeks, rows weekdays.
export function buildActivityColumns(weeks = 14): HeatmapColumn[] {
  const rnd = seeded(5153);
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks - 1) * 7 - today.getDay());
  const columns: HeatmapColumn[] = [];
  for (let w = 0; w < weeks; w++) {
    const bins = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const weekend = d === 0 || d === 6;
      const future = date > today;
      const count = future ? 0 : Math.round((weekend ? 3 : 12) * rnd() + (weekend ? 0 : 3));
      bins.push({ bin: d, count, date });
    }
    columns.push({ bin: w, bins });
  }
  return columns;
}

export function ActivityHeatmap({ weeks = 14 }: { weeks?: number }) {
  const data = buildActivityColumns(weeks);
  return (
    <HeatmapChart data={data} layout="fluid" gap={3} margin={{ top: 12, right: 12, bottom: 24, left: 34 }}>
      <HeatmapYAxis />
      <HeatmapXAxis />
      <HeatmapCells cornerRadius={2} />
    </HeatmapChart>
  );
}
