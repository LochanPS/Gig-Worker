import { useMemo } from 'react';
import { revenueSeries } from '@/lib/demoSeries';
import { formatMoney } from '@/lib/money';
import { PageHeader, Stat, StatRow } from '@/components/PageHeader';
import { Panel } from '@/components/ui/primitives';
import { Money } from '@/components/Money';
import { TreasuryComposed } from '@/components/charts/gb/TreasuryComposed';

interface Liquidity {
  corridor: string;
  inboundMinor: number;
  outboundMinor: number;
  currency: string;
}

const LIQUIDITY: Liquidity[] = [
  { corridor: 'EUR to INR', inboundMinor: 4_820_00, outboundMinor: 4_610_00, currency: 'USD' },
  { corridor: 'USD to INR', inboundMinor: 2_140_00, outboundMinor: 2_090_00, currency: 'USD' },
  { corridor: 'INR to USD', inboundMinor: 610_00, outboundMinor: 640_00, currency: 'USD' },
];

export function AdminTreasury() {
  const series = useMemo(() => revenueSeries(30), []);
  const escrowBalance = (series[series.length - 1]?.escrow ?? 0) * 100;
  const feeRevenue = series.reduce((s, d) => s + d.revenue, 0) * 100;

  return (
    <>
      <PageHeader title="Treasury" />
      <StatRow>
        <Stat label="Escrow vault balance" value={<Money minor={escrowBalance} currency="USD" size="xl" />} note="held on-chain" />
        <Stat label="Fee revenue, 30 days" value={<Money minor={feeRevenue} currency="USD" size="xl" className="text-ok" />} delta={{ value: '+8.1%', positive: true }} />
        <Stat label="Active corridors" value={<span className="num text-[26px]">3</span>} />
        <Stat label="Net position" value={<Money minor={LIQUIDITY.reduce((s, l) => s + l.inboundMinor - l.outboundMinor, 0)} currency="USD" size="xl" />} note="inbound minus outbound" />
      </StatRow>

      <Panel className="mt-5 p-5">
        <div className="label mb-1">Fee revenue against escrow balance</div>
        <p className="text-[12px] text-faint mb-4 max-w-[70ch]">Bars are daily fee revenue. The line is the escrow balance held across all open payments.</p>
        <TreasuryComposed data={series} height={300} />
      </Panel>

      <Panel className="mt-5">
        <div className="border-b border-line px-4 h-11 flex items-center">
          <h2 className="text-[13px] font-medium">Per-corridor liquidity</h2>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line">
              <th className="label h-9 px-4 text-left font-normal">Corridor</th>
              <th className="label h-9 px-4 text-right font-normal">Inbound</th>
              <th className="label h-9 px-4 text-right font-normal">Outbound</th>
              <th className="label h-9 px-4 text-right font-normal">Net position</th>
            </tr>
          </thead>
          <tbody>
            {LIQUIDITY.map((l) => {
              const net = l.inboundMinor - l.outboundMinor;
              return (
                <tr key={l.corridor} className="border-b border-line h-11 last:border-b-0">
                  <td className="px-4 num text-[13px] text-text">{l.corridor}</td>
                  <td className="px-4 text-right"><Money minor={l.inboundMinor} currency={l.currency} /></td>
                  <td className="px-4 text-right"><Money minor={l.outboundMinor} currency={l.currency} /></td>
                  <td className={`px-4 text-right num text-[13px] ${net >= 0 ? 'text-ok' : 'text-warn'}`}>{formatMoney(net, l.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
