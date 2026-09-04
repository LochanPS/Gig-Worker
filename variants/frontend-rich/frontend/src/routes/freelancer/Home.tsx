import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Payment } from '@gigbridge/shared';
import { useAuth } from '@/lib/auth';
import { useAsync } from '@/lib/useAsync';
import { useRealtime } from '@/lib/realtime';
import { gateway } from '@/lib/gateway';
import { formatMoney, retentionPct } from '@/lib/money';
import { INCUMBENT_FEE_PCT } from '@gigbridge/shared';
import { formatDate } from '@/lib/format';
import { payerName, corridorLabel, IS_TERMINAL } from '@/lib/paymentView';
import { PageHeader } from '@/components/PageHeader';
import { Panel } from '@/components/ui/primitives';
import { Money } from '@/components/Money';
import { StatusChip } from '@/components/StatusChip';
import { PaymentTimeline } from '@/components/PaymentTimeline';
import { Confetti } from '@/components/Confetti';
import { SimpleBars } from '@/components/charts/gb/SimpleBars';
import { Async } from '@/components/ui/states';

export function FreelancerHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const state = useAsync<Payment[]>(() => gateway.listPayments(), []);
  const { byPayment, feed } = useRealtime();

  // A payment created after mount arrives via the realtime feed; refetch the
  // list so it enters the balance and the in-flight timeline.
  const feedLen = feed.length;
  const reload = state.reload;
  useEffect(() => {
    if (feedLen) reload();
  }, [feedLen, reload]);
  const [celebrated, setCelebrated] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ amount: string; kept: number } | null>(null);

  const mine = useMemo(() => (state.data ?? []).filter((p) => p.freelancerId === user?.id), [state.data, user]);

  // Merge live state onto each payment.
  const merged = useMemo(
    () =>
      mine.map((p) => {
        const live = byPayment[p.id];
        return live ? { ...p, state: live.state, timeline: live.timeline.length ? live.timeline : p.timeline } : p;
      }),
    [mine, byPayment],
  );

  const inFlight = merged.find((p) => !IS_TERMINAL(p.state));
  const completed = merged.filter((p) => p.state === 'COMPLETED');

  const balances = useMemo(() => {
    const inr = completed.filter((p) => p.dstCurrency === 'INR').reduce((s, p) => s + (p.dstAmountMinor ?? 0), 0);
    const held: Record<string, number> = {};
    for (const p of merged) {
      if (p.state === 'FUNDED' || p.state === 'SETTLING') held[p.srcCurrency] = (held[p.srcCurrency] ?? 0) + p.srcAmountMinor;
    }
    return { inr, held };
  }, [completed, merged]);

  // Fire confetti + retention banner when any of my payments reaches COMPLETED.
  useEffect(() => {
    const justDone = merged.find((p) => p.state === 'COMPLETED' && byPayment[p.id]?.state === 'COMPLETED');
    if (justDone && justDone.id !== celebrated) {
      setCelebrated(justDone.id);
      const kept = retentionPct(justDone.srcAmountMinor, justDone.feeAmountMinor ?? 0);
      setBanner({ amount: formatMoney(justDone.dstAmountMinor, justDone.dstCurrency), kept });
    }
  }, [merged, byPayment, celebrated]);

  // Real 12-week earnings for this account, bucketed from completed payments.
  const earnings = useMemo(() => {
    const weekMs = 7 * 86_400_000;
    const now = Date.now();
    const buckets = Array.from({ length: 12 }, (_, i) => ({ name: `W${i + 1}`, earnedMinor: 0 }));
    for (const p of completed) {
      if (p.dstCurrency !== 'INR' || p.dstAmountMinor == null) continue;
      const weeksAgo = Math.floor((now - new Date(p.createdAt).getTime()) / weekMs);
      const idx = 11 - weeksAgo;
      if (idx >= 0 && idx < 12) buckets[idx].earnedMinor += p.dstAmountMinor;
    }
    return buckets;
  }, [completed]);
  const incumbentKept = (1 - INCUMBENT_FEE_PCT) * 100;

  return (
    <>
      <PageHeader title="Your balance" />

      <Panel className="relative p-8 overflow-hidden">
        <Confetti trigger={celebrated} />
        <div className="label mb-2">Available in INR</div>
        <Money minor={balances.inr} currency="INR" size="hero" className="text-text" />
        {Object.keys(balances.held).length ? (
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
            {Object.entries(balances.held).map(([cur, minor]) => (
              <div key={cur}>
                <div className="label text-[10px] mb-1">Held in {cur}</div>
                <Money minor={minor} currency={cur} size="lg" className="text-muted" />
              </div>
            ))}
          </div>
        ) : null}

        {banner ? (
          <div className="mt-6 border border-ok bg-ok/8 p-4">
            <div className="text-[13px] text-text">You received {banner.amount}</div>
            <p className="text-[12px] text-muted mt-1">
              You kept <span className="num text-ok">{banner.kept.toFixed(2)} percent</span> of the gross. A typical
              intermediary would have left you near <span className="num">{incumbentKept.toFixed(0)} percent</span>.
            </p>
          </div>
        ) : null}
      </Panel>

      {inFlight ? (
        <Panel className="mt-5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px]">Incoming from {payerName(inFlight)}</h2>
            <StatusChip state={inFlight.state} />
          </div>
          <PaymentTimeline timeline={inFlight.timeline} framing="payee" />
        </Panel>
      ) : null}

      <div className="grid lg:grid-cols-12 gap-5 mt-5">
        <Panel className="lg:col-span-7">
          <div className="border-b border-line px-4 h-12 flex items-center">
            <h2 className="text-[13px] font-medium">Earnings, last 12 weeks</h2>
          </div>
          <div className="p-4">
            <SimpleBars
              data={earnings}
              dataKey="earnedMinor"
              height={240}
              valueLabel="Net received"
              valueFormat={(n) => formatMoney(n, 'INR')}
            />
          </div>
        </Panel>

        <Panel className="lg:col-span-5">
          <div className="border-b border-line px-4 h-12 flex items-center">
            <h2 className="text-[13px] font-medium">Recent payments</h2>
          </div>
          <Async state={state} what="your payments" onRetry={state.reload} empty={{ title: 'No payments yet', body: 'Payments you receive will show up here as they settle.' }}>
            {() => (
              <ul className="divide-y divide-line">
                {[...merged].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => navigate(`/me/history`)}
                      className="w-full flex items-center justify-between gap-3 px-4 h-14 text-left hover:bg-raised transition-colors"
                    >
                      <span className="flex flex-col">
                        <span className="text-[13px] text-text">{payerName(p)}</span>
                        <span className="text-[11px] text-faint num">{corridorLabel(p)} · {formatDate(p.createdAt)}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <Money minor={p.dstAmountMinor} currency={p.dstCurrency} />
                        <StatusChip state={p.state} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </Panel>
      </div>
    </>
  );
}
