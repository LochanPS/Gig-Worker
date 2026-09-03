import { useEffect, useMemo, useRef, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { AdminMetrics, Payment } from '@gigbridge/shared';
import { useAsync } from '@/lib/useAsync';
import { useRealtime } from '@/lib/realtime';
import { gateway } from '@/lib/gateway';
import { settlementHistogram } from '@/lib/demoSeries';
import { formatMoney } from '@/lib/money';
import { formatTime } from '@/lib/format';
import { corridorLabel, payerName, payeeName } from '@/lib/paymentView';
import { PageHeader } from '@/components/PageHeader';
import { Panel } from '@/components/ui/primitives';
import { StatusChip } from '@/components/StatusChip';
import { Money } from '@/components/Money';
import { LiveVolume } from '@/components/charts/gb/LiveVolume';
import { DonutChart } from '@/components/charts/gb/DonutChart';
import { SimpleBars } from '@/components/charts/gb/SimpleBars';
import { GaugeChart } from '@/components/charts/gb/GaugeChart';
import { MoneyFlowSankey } from '@/components/charts/gb/MoneyFlowSankey';

function useVolumeStream(metrics: AdminMetrics | null) {
  const [points, setPoints] = useState<{ time: number; value: number }[]>(() => {
    const now = Math.floor(Date.now() / 1000);
    return Array.from({ length: 30 }, (_, i) => ({ time: now - (30 - i), value: 1200 + Math.sin(i / 3) * 240 }));
  });
  const base = metrics ? metrics.volume24hMinorUsd / 100 / 24 : 1300;
  const baseRef = useRef(base);
  baseRef.current = base;

  useEffect(() => {
    const id = window.setInterval(() => {
      setPoints((prev) => {
        const t = Math.floor(Date.now() / 1000);
        const value = Math.max(200, baseRef.current + (Math.random() - 0.5) * baseRef.current * 0.5);
        return [...prev.slice(-40), { time: t, value }];
      });
    }, 1500);
    return () => window.clearInterval(id);
  }, []);

  return { data: points, value: points[points.length - 1]?.value ?? base };
}

export function AdminMonitor() {
  const reduce = useReducedMotion();
  const { metrics: liveMetrics, feed } = useRealtime();
  const initial = useAsync<AdminMetrics>(() => gateway.adminMetrics(), []);
  const payState = useAsync<Payment[]>(() => gateway.listPayments(), []);
  const metrics = liveMetrics ?? initial.data ?? null;
  const stream = useVolumeStream(metrics);

  // Resolve feed rows against the payments list; refetch as the feed grows.
  const feedLen = feed.length;
  useEffect(() => {
    if (feedLen) payState.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedLen]);

  const paymentsById = useMemo(() => {
    const m = new Map<string, Payment>();
    for (const p of payState.data ?? []) m.set(p.id, p);
    return m;
  }, [payState.data]);

  const donut = [
    { label: 'EUR to INR', value: 62 },
    { label: 'USD to INR', value: 27 },
    { label: 'INR to USD', value: 11 },
  ];
  const histogram = useMemo(() => settlementHistogram(), []);

  return (
    <>
      <PageHeader title="Live monitor" />

      <Panel className="grid grid-cols-2 md:grid-cols-5 divide-x divide-line">
        <MetricCell label="24h volume" value={metrics ? metrics.volume24hMinorUsd / 100 : 0} prefix="" suffix=" USD" />
        <MetricCell label="Revenue" value={metrics ? metrics.revenueMinorUsd / 100 : 0} prefix="" suffix=" USD" fraction={2} />
        <MetricCell label="Active corridors" value={metrics?.activeCorridors ?? 0} />
        <MetricCell label="Avg settlement" value={metrics?.avgSettlementSeconds ?? 0} suffix=" sec" />
        <MetricCell label="Flagged" value={metrics?.flaggedPct ?? 0} suffix=" %" fraction={1} />
      </Panel>

      <div className="grid lg:grid-cols-12 gap-5 mt-5">
        <Panel className="lg:col-span-7">
          <div className="border-b border-line px-4 h-12 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Payment events</h2>
            <span className="num text-[11px] text-faint">{feed.length} live</span>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {feed.length === 0 ? (
              <p className="px-4 py-10 text-[13px] text-muted text-center">
                Waiting for activity. New payment events stream in here as they happen across every corridor.
              </p>
            ) : (
              <ul>
                <AnimatePresence initial={false}>
                  {feed.map((ev) => {
                    const p = paymentsById.get(ev.paymentId);
                    return (
                      <motion.li
                        key={`${ev.paymentId}-${ev.at}`}
                        layout
                        initial={reduce ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 44 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="flex items-center gap-3 px-4 border-b border-line overflow-hidden"
                        style={{ height: 44 }}
                      >
                        <span className="num text-[11px] text-faint w-[64px] shrink-0">{formatTime(new Date(ev.at).toISOString())}</span>
                        <span className="text-[12px] text-muted w-[120px] shrink-0 truncate">{p ? payerName(p) : 'Payment'}</span>
                        <span className="text-[12px] text-text flex-1 truncate">{p ? payeeName(p) : ev.paymentId.slice(0, 8)}</span>
                        {p ? <span className="num text-[11px] text-muted w-[92px] shrink-0 text-right">{corridorLabel(p)}</span> : null}
                        {p ? <Money minor={p.srcAmountMinor} currency={p.srcCurrency} className="w-[110px] text-right shrink-0" /> : <span className="w-[110px]" />}
                        <StatusChip state={ev.state} />
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </Panel>

        <Panel className="lg:col-span-5">
          <div className="border-b border-line px-4 h-12 flex items-center">
            <h2 className="text-[13px] font-medium">Settlement volume, live</h2>
          </div>
          <div className="p-4">
            <LiveVolume data={stream.data} value={stream.value} height={280} />
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mt-5">
        <Panel className="p-4">
          <div className="label mb-4">Corridor share</div>
          <div className="flex justify-center">
            <DonutChart data={donut} size={200} centerLabel="Corridors" />
          </div>
        </Panel>
        <Panel className="p-4">
          <div className="label mb-4">Settlement time</div>
          <SimpleBars data={histogram} dataKey="count" height={200} />
        </Panel>
        <Panel className="p-4">
          <div className="label mb-4">Flagged rate</div>
          <div className="flex justify-center">
            <GaugeChart value={metrics?.flaggedPct ?? 0} target={5} max={20} />
          </div>
        </Panel>
      </div>

      <Panel className="mt-5 p-5">
        <div className="label mb-1">Corridor money flow</div>
        <p className="text-[12px] text-faint mb-4 max-w-[70ch]">
          Euros enter, convert to stablecoin in escrow, and land as rupees. The thin branch is the platform fee, the only
          cut GigBridge takes.
        </p>
        <MoneyFlowSankey eurInflow={1000} feeShare={7.5} height={320} />
      </Panel>
    </>
  );
}

function MetricCell({
  label,
  value,
  prefix = '',
  suffix = '',
  fraction = 0,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  fraction?: number;
}) {
  return (
    <div className="px-4 py-4">
      <div className="label mb-2">{label}</div>
      <div className="num text-[26px] text-text tabular-nums">
        <NumberFlow value={value} prefix={prefix} suffix={suffix} format={{ maximumFractionDigits: fraction, minimumFractionDigits: fraction }} />
      </div>
    </div>
  );
}
