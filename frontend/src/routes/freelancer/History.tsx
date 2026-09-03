import { Fragment, useMemo, useState } from 'react';
import { CaretDown, CaretRight } from '@phosphor-icons/react';
import type { Payment } from '@gigbridge/shared';
import { useAuth } from '@/lib/auth';
import { useAsync } from '@/lib/useAsync';
import { gateway } from '@/lib/gateway';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format';
import { payerName, corridorLabel } from '@/lib/paymentView';
import { makeTextPdf, downloadBlob } from '@/lib/pdf';
import { PageHeader } from '@/components/PageHeader';
import { Panel, Button, Select } from '@/components/ui/primitives';
import { Money } from '@/components/Money';
import { Async, EmptyState } from '@/components/ui/states';

function appliedRate(p: Payment): number {
  const net = p.srcAmountMinor - (p.feeAmountMinor ?? 0);
  if (net <= 0 || p.dstAmountMinor == null) return 0;
  return p.dstAmountMinor / net;
}

export function FreelancerHistory() {
  const { user } = useAuth();
  const state = useAsync<Payment[]>(() => gateway.listPayments(), []);
  const [open, setOpen] = useState<string | null>(null);
  const [corridor, setCorridor] = useState('ALL');
  const [since, setSince] = useState('ALL');

  const mine = useMemo(
    () => (state.data ?? []).filter((p) => p.freelancerId === user?.id && (p.state === 'COMPLETED' || p.state === 'REFUNDED')),
    [state.data, user],
  );

  const corridors = useMemo(() => Array.from(new Set(mine.map(corridorLabel))), [mine]);

  const rows = useMemo(() => {
    let r = mine;
    if (corridor !== 'ALL') r = r.filter((p) => corridorLabel(p) === corridor);
    if (since !== 'ALL') {
      const days = Number(since);
      const cut = Date.now() - days * 86_400_000;
      r = r.filter((p) => +new Date(p.createdAt) >= cut);
    }
    return [...r].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [mine, corridor, since]);

  function receipt(p: Payment) {
    downloadBlob(
      makeTextPdf('GigBridge earnings receipt', [
        `Reference: ${p.id}`,
        `From: ${payerName(p)}`,
        `Date: ${formatDate(p.createdAt)}`,
        `Gross: ${formatMoney(p.srcAmountMinor, p.srcCurrency)}`,
        `Fee: ${formatMoney(p.feeAmountMinor, p.srcCurrency)}`,
        `Net received: ${formatMoney(p.dstAmountMinor, p.dstCurrency)}`,
        `Applied rate: 1 ${p.srcCurrency} = ${appliedRate(p).toFixed(4)} ${p.dstCurrency}`,
      ]),
      `earnings-${p.id.slice(0, 8)}.pdf`,
    );
  }

  return (
    <>
      <PageHeader title="History" />
      <div className="flex items-center gap-3 mb-4">
        <Select value={corridor} onChange={(e) => setCorridor(e.target.value)} className="w-auto h-8 text-[12px]">
          <option value="ALL">All corridors</option>
          {corridors.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={since} onChange={(e) => setSince(e.target.value)} className="w-auto h-8 text-[12px]">
          <option value="ALL">All time</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </Select>
      </div>

      <Panel>
        <Async state={state} what="your history" onRetry={state.reload}>
          {() =>
            rows.length === 0 ? (
              <EmptyState title="Nothing here yet" body="Completed payments will appear here with the full fee breakdown for each." />
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-line">
                    <th className="label h-9 px-4 text-left font-normal w-[28px]"></th>
                    <th className="label h-9 px-4 text-left font-normal">From</th>
                    <th className="label h-9 px-4 text-right font-normal">Gross</th>
                    <th className="label h-9 px-4 text-right font-normal">Fee</th>
                    <th className="label h-9 px-4 text-right font-normal">Rate</th>
                    <th className="label h-9 px-4 text-right font-normal">Net received</th>
                    <th className="label h-9 px-4 text-right font-normal">Date</th>
                    <th className="label h-9 px-4 text-right font-normal"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const isOpen = open === p.id;
                    return (
                      <Fragment key={p.id}>
                        <tr
                          className="border-b border-line h-11 hover:bg-raised transition-colors cursor-pointer"
                          onClick={() => setOpen(isOpen ? null : p.id)}
                        >
                          <td className="px-4 text-faint">{isOpen ? <CaretDown size={13} /> : <CaretRight size={13} />}</td>
                          <td className="px-4 text-[13px] text-text">{payerName(p)}</td>
                          <td className="px-4 text-right"><Money minor={p.srcAmountMinor} currency={p.srcCurrency} /></td>
                          <td className="px-4 text-right text-muted"><Money minor={p.feeAmountMinor} currency={p.srcCurrency} /></td>
                          <td className="px-4 text-right num text-[12px] text-muted">{appliedRate(p).toFixed(3)}</td>
                          <td className="px-4 text-right"><Money minor={p.dstAmountMinor} currency={p.dstCurrency} className="text-ok" /></td>
                          <td className="px-4 text-right num text-[12px] text-muted">{formatDate(p.createdAt)}</td>
                          <td className="px-4 text-right">
                            <Button size="sm" variant="quiet" onClick={(e) => { e.stopPropagation(); receipt(p); }}>Receipt</Button>
                          </td>
                        </tr>
                        {isOpen ? (
                          <tr className="border-b border-line bg-bg">
                            <td colSpan={8} className="px-4 py-4">
                              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-[640px]">
                                <Cell label="Gross sent" value={formatMoney(p.srcAmountMinor, p.srcCurrency)} />
                                <Cell label="Platform fee" value={formatMoney(p.feeAmountMinor, p.srcCurrency)} />
                                <Cell label="Applied FX rate" value={`${appliedRate(p).toFixed(4)} ${p.dstCurrency}/${p.srcCurrency}`} />
                                <Cell label="Net received" value={formatMoney(p.dstAmountMinor, p.dstCurrency)} accent />
                              </dl>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )
          }
        </Async>
      </Panel>
    </>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="label text-[10px] mb-1">{label}</div>
      <div className={`num text-[13px] ${accent ? 'text-ok' : 'text-text'}`}>{value}</div>
    </div>
  );
}
