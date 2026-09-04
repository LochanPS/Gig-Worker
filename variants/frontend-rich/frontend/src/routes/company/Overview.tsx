import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretRight } from '@phosphor-icons/react';
import type { Payment, PaymentState } from '@gigbridge/shared';
import { useAuth } from '@/lib/auth';
import { useAsync } from '@/lib/useAsync';
import { gateway } from '@/lib/gateway';
import { fxSeries } from '@/lib/demoSeries';
import { formatMoney, incumbentFee } from '@/lib/money';
import { formatDate, formatDuration } from '@/lib/format';
import { corridorLabel, payeeName, settlementSeconds, IS_TERMINAL } from '@/lib/paymentView';
import { PageHeader, Stat, StatRow } from '@/components/PageHeader';
import { Panel, PanelHead, Button, Input } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/controls';
import { Money } from '@/components/Money';
import { StatusChip } from '@/components/StatusChip';
import { DataTable, type Column } from '@/components/DataTable';
import { Async, ValuePending, EmptyState } from '@/components/ui/states';
import { CorridorChart } from '@/components/charts/gb/CorridorChart';

const FILTERS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'In flight' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FLAGGED', label: 'Flagged' },
];

export function CompanyOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const state = useAsync<Payment[]>(() => gateway.listPayments(), []);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<'7' | '30' | '90'>('30');

  const mine = useMemo(
    () => (state.data ?? []).filter((p) => !user || p.companyId === user.id),
    [state.data, user],
  );

  const stats = useMemo(() => {
    const completed = mine.filter((p) => p.state === 'COMPLETED');
    const totalPaid = completed.reduce((s, p) => s + p.srcAmountMinor, 0);
    const inEscrow = mine.filter((p) => p.state === 'FUNDED' || p.state === 'SETTLING').reduce((s, p) => s + p.srcAmountMinor, 0);
    const saved = completed.reduce((s, p) => s + Math.max(incumbentFee(p.srcAmountMinor) - (p.feeAmountMinor ?? 0), 0), 0);
    const secs = completed.map(settlementSeconds).filter((x): x is number => x !== null);
    const avg = secs.length ? secs.reduce((a, b) => a + b, 0) / secs.length : null;
    const currency = mine[0]?.srcCurrency ?? 'EUR';
    return { totalPaid, inEscrow, saved, avg, currency };
  }, [mine]);

  const rows = useMemo(() => {
    let r = mine;
    if (filter === 'ACTIVE') r = r.filter((p) => !IS_TERMINAL(p.state));
    else if (filter === 'COMPLETED') r = r.filter((p) => p.state === 'COMPLETED');
    else if (filter === 'FLAGGED') r = r.filter((p) => p.state === 'FLAGGED');
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter((p) => payeeName(p).toLowerCase().includes(q));
    }
    return [...r].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [mine, filter, search]);

  const series = useMemo(() => fxSeries('EURINR', Number(range)), [range]);

  const columns: Column<Payment>[] = [
    { key: 'payee', header: 'Payee', render: (p) => <span className="text-text">{payeeName(p)}</span> },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (p) => <Money minor={p.srcAmountMinor} currency={p.srcCurrency} />,
    },
    { key: 'corridor', header: 'Corridor', render: (p) => <span className="num text-[12px] text-muted">{corridorLabel(p)}</span> },
    { key: 'state', header: 'State', render: (p) => <StatusChip state={p.state as PaymentState} /> },
    { key: 'date', header: 'Date', align: 'right', render: (p) => <span className="num text-[12px] text-muted">{formatDate(p.createdAt)}</span> },
    { key: 'go', header: '', align: 'right', width: '40px', render: () => <CaretRight size={14} className="text-faint" /> },
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        action={<Button variant="primary" onClick={() => navigate('/company/pay')}>New payout</Button>}
      />

      <StatRow>
        <Stat
          label="Total paid, 30 days"
          value={state.loading ? <ValuePending /> : <Money minor={stats.totalPaid} currency={stats.currency} size="xl" />}
          delta={{ value: '+12.4%', positive: true }}
        />
        <Stat
          label="In escrow"
          value={state.loading ? <ValuePending /> : <Money minor={stats.inEscrow} currency={stats.currency} size="xl" />}
          note="held on-chain"
        />
        <Stat
          label="Fees saved"
          value={state.loading ? <ValuePending /> : <Money minor={stats.saved} currency={stats.currency} size="xl" className="text-ok" />}
          note="vs 9% incumbent"
        />
        <Stat
          label="Avg settlement"
          value={
            state.loading ? (
              <ValuePending />
            ) : (
              <span className="num text-[26px] text-text">{stats.avg ? formatDuration(stats.avg) : '-'}</span>
            )
          }
          note="incumbents 3 to 5 days"
        />
      </StatRow>

      <div className="grid lg:grid-cols-12 gap-5 mt-5">
        <Panel className="lg:col-span-8">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 h-12 flex-wrap">
            <Segmented options={FILTERS} value={filter} onChange={setFilter} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payee"
              className="h-7 max-w-[180px] text-[12px]"
              aria-label="Search payee"
            />
          </div>
          <Async
            state={state}
            what="payouts"
            onRetry={state.reload}
          >
            {() =>
              rows.length === 0 ? (
                <EmptyState
                  title="No payouts to show"
                  body="Create your first payout and it will appear here as it moves through settlement."
                  action={{ label: 'New payout', onClick: () => navigate('/company/pay') }}
                />
              ) : (
                <DataTable
                  columns={columns}
                  rows={rows}
                  rowKey={(p) => p.id}
                  onRowClick={(p) => navigate(`/company/payments/${p.id}`)}
                />
              )
            }
          </Async>
        </Panel>

        <Panel className="lg:col-span-4">
          <div className="flex items-center justify-between border-b border-line px-4 h-12">
            <h2 className="text-[13px] font-medium">EUR to INR corridor</h2>
            <Segmented
              options={[
                { value: '7', label: '7d' },
                { value: '30', label: '30d' },
                { value: '90', label: '90d' },
              ]}
              value={range}
              onChange={setRange}
            />
          </div>
          <div className="p-4">
            <CorridorChart data={series} height={240} axes />
          </div>
        </Panel>
      </div>
    </>
  );
}
