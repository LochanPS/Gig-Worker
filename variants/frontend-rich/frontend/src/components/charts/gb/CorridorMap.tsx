import type { FeatureCollection, Geometry } from 'geojson';
import { ChoroplethChart } from '../choropleth/choropleth-chart';
import { ChoroplethFeatureComponent } from '../choropleth';
import type { ChoroplethFeatureProperties } from '../choropleth/choropleth-context';
import world from '@/data/world.geo.json';

const data = world as unknown as FeatureCollection<Geometry, ChoroplethFeatureProperties>;

// Countries that participate in a live corridor, weighted by relative volume.
const CORRIDOR_WEIGHT: Record<string, number> = {
  Germany: 1,
  India: 1,
  'United States of America': 0.55,
  'United Kingdom': 0.35,
  Netherlands: 0.25,
  France: 0.2,
};

function colorFor(name: string | undefined): string {
  const w = name ? CORRIDOR_WEIGHT[name] : undefined;
  if (w === undefined) return 'var(--chart-scale-01)';
  if (w >= 0.9) return 'var(--chart-scale-05)';
  if (w >= 0.5) return 'var(--chart-scale-04)';
  if (w >= 0.3) return 'var(--chart-scale-03)';
  return 'var(--chart-scale-02)';
}

export function CorridorMap({ height = 320 }: { height?: number }) {
  return (
    <div style={{ height }}>
      <ChoroplethChart data={data} aspectRatio="2 / 1" center={[10, 25]} scale={110}>
        <ChoroplethFeatureComponent
          stroke="var(--color-line)"
          strokeWidth={0.4}
          getFeatureColor={(f) => colorFor(f.properties?.name)}
        />
      </ChoroplethChart>
    </div>
  );
}
