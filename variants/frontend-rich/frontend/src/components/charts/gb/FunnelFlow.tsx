import { FunnelChart, type FunnelStage } from '../funnel-chart';

// Created -> completed. Single brand hue, staged.
export function FunnelFlow({ stages }: { stages: FunnelStage[] }) {
  return (
    <FunnelChart
      data={stages}
      orientation="horizontal"
      color="var(--chart-1)"
      showValues
      showPercentage
      showLabels
      gap={4}
      grid
    />
  );
}
