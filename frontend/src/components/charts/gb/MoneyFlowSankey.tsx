import { SankeyChart, SankeyNode, SankeyLink, type SankeyData } from '../sankey';

// The pitch's centrepiece: euros entering, converting to stablecoin, landing as rupees,
// with the thin platform-fee branch visible. Values are relative volume units.
export function MoneyFlowSankey({
  eurInflow,
  feeShare,
  height = 320,
}: {
  eurInflow: number;
  feeShare: number;
  height?: number;
}) {
  const net = Math.max(eurInflow - feeShare, 0);
  const data: SankeyData = {
    nodes: [
      { name: 'EUR in', category: 'source' },
      { name: 'USDC escrow', category: 'landing' },
      { name: 'INR payout', category: 'outcome' },
      { name: 'Platform fee', category: 'outcome' },
    ],
    links: [
      { source: 0, target: 1, value: net },
      { source: 0, target: 3, value: feeShare },
      { source: 1, target: 2, value: net },
    ],
  };
  const color = (name: string) =>
    name === 'Platform fee' ? 'var(--chart-4)' : name === 'INR payout' ? 'var(--chart-2)' : 'var(--chart-1)';

  return (
    <div style={{ height }}>
      <SankeyChart data={data} aspectRatio="5 / 2" nodePadding={28} nodeWidth={14}>
        <SankeyLink useGradient />
        <SankeyNode getNodeColor={(n) => color(n.name)} />
      </SankeyChart>
    </div>
  );
}
