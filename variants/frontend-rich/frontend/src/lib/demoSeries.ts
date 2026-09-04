// Deterministic series used where the mock API exposes no history endpoint.
// Seeded so charts are stable across reloads and demo runs.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const BASE: Record<string, number> = { EURINR: 90.24, USDINR: 83.1, INRUSD: 0.01203 };

export function fxSeries(pair: string, days = 30): { date: string; rate: number }[] {
  const rnd = seeded(pair.length * 977 + days);
  const base = BASE[pair] ?? 1;
  let drift = 0;
  return Array.from({ length: days }, (_, i) => {
    drift += (rnd() - 0.48) * base * 0.004;
    const wave = Math.sin(i / 4.2) * base * 0.0035;
    return {
      date: new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10),
      rate: Number((base + drift + wave).toFixed(4)),
    };
  });
}

export function volumeSeries(days = 30): { date: string; volume: number }[] {
  const rnd = seeded(4211);
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10),
    volume: Math.round(1800 + rnd() * 5200 + Math.sin(i / 3) * 900),
  }));
}

export function earningsSeries(weeks = 12): { name: string; earned: number }[] {
  const rnd = seeded(8821);
  return Array.from({ length: weeks }, (_, i) => ({
    name: `W${i + 1}`,
    earned: Math.round(24_000 + rnd() * 46_000),
  }));
}

export function settlementHistogram(): { name: string; count: number }[] {
  return [
    { name: '0-20s', count: 6 },
    { name: '20-40s', count: 21 },
    { name: '40-60s', count: 27 },
    { name: '60-90s', count: 11 },
    { name: '90s+', count: 3 },
  ];
}

export function revenueSeries(days = 30): { date: string; revenue: number; escrow: number }[] {
  const rnd = seeded(3307);
  let escrow = 42_000;
  return Array.from({ length: days }, (_, i) => {
    escrow += (rnd() - 0.45) * 5200;
    return {
      date: new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10),
      revenue: Math.round(180 + rnd() * 260 + i * 6),
      escrow: Math.round(Math.max(escrow, 12_000)),
    };
  });
}
