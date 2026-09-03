// Minimal inline-SVG line chart for FX corridor / earnings. Theme-token colored,
// area fill + emphasized endpoint, no chart library.
interface Point { x: number; y: number; }

export default function Sparkline({ data, height = 64, label }: { data: number[]; height?: number; label?: string }) {
  if (data.length < 2) return <div className="muted" style={{ fontSize: 12 }}>Not enough data</div>;
  const w = 260, h = height, pad = 4;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts: Point[] = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (w - 2 * pad),
    y: pad + (1 - (v - min) / span) * (h - 2 * pad),
  }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${h - pad} L${pts[0].x.toFixed(1)},${h - pad} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={label ?? 'trend'} preserveAspectRatio="none">
      <path d={area} fill="var(--accent)" opacity="0.12" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.6" />
      <circle cx={last.x} cy={last.y} r="3" fill="var(--accent)" />
    </svg>
  );
}
