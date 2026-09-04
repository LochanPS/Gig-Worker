import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Currency, PurposeCode, Verdict } from '@gigbridge/shared';
import { FREELANCERS } from '@/lib/directory';
import { gateway } from '@/lib/gateway';
import { parseMoney, formatMoney, pairOf } from '@/lib/money';
import { evaluateCompliance } from '@/lib/compliance';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { Panel, Button, Input } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/controls';
import { DataTable, type Column } from '@/components/DataTable';
import { Money } from '@/components/Money';

interface SeedInvoice {
  id: string;
  freelancerId: string;
  amountMinor: number;
  currency: Currency;
  memo: string;
  status: 'SENT' | 'APPROVED' | 'PAID';
  createdAt: string;
}

const INCOMING: SeedInvoice[] = [
  { id: 'inv-2001', freelancerId: FREELANCERS[0].id, amountMinor: 120000, currency: 'EUR', memo: 'March design retainer', status: 'SENT', createdAt: '2026-09-01T09:12:00Z' },
  { id: 'inv-2002', freelancerId: FREELANCERS[2].id, amountMinor: 45000, currency: 'EUR', memo: 'API integration sprint', status: 'SENT', createdAt: '2026-09-02T15:40:00Z' },
];

const VERDICT_STYLE: Record<Verdict, string> = {
  APPROVE: 'text-ok',
  FLAG: 'text-warn',
  REJECT: 'text-danger',
};

export function CompanyInvoices() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'incoming' | 'batch'>('incoming');

  return (
    <>
      <PageHeader title="Invoices" />
      <Segmented
        options={[
          { value: 'incoming', label: 'Incoming' },
          { value: 'batch', label: 'Batch payout' },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />
      {tab === 'incoming' ? <Incoming navigate={navigate} /> : <Batch />}
    </>
  );
}

function Incoming({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const nameOf = (id: string) => FREELANCERS.find((f) => f.id === id)?.name ?? 'Unknown';
  const columns: Column<SeedInvoice>[] = [
    { key: 'from', header: 'From', render: (r) => <span className="text-text">{nameOf(r.freelancerId)}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: (r) => <Money minor={r.amountMinor} currency={r.currency} /> },
    { key: 'memo', header: 'Memo', render: (r) => <span className="text-muted text-[13px]">{r.memo}</span> },
    { key: 'date', header: 'Date', align: 'right', render: (r) => <span className="num text-[12px] text-muted">{formatDate(r.createdAt)}</span> },
    { key: 'state', header: 'State', render: (r) => <span className="text-[11px] uppercase tracking-[0.06em] text-muted">{r.status}</span> },
    {
      key: 'approve',
      header: '',
      align: 'right',
      width: '96px',
      render: (r) => (
        <Button
          size="sm"
          variant="default"
          onClick={() => navigate('/company/pay', { state: { payeeId: r.freelancerId, startStep: 2, amountMinor: r.amountMinor, invoiceRef: r.id } })}
        >
          Approve, pay
        </Button>
      ),
    },
  ];
  return (
    <Panel>
      <DataTable columns={columns} rows={INCOMING} rowKey={(r) => r.id} />
    </Panel>
  );
}

interface BatchRow {
  freelancerId: string;
  amount: string;
  selected: boolean;
  verdict?: Verdict;
  paymentId?: string;
}

function Batch() {
  const [rows, setRows] = useState<BatchRow[]>(FREELANCERS.map((f) => ({ freelancerId: f.id, amount: '', selected: false })));
  const [ran, setRan] = useState(false);
  const [busy, setBusy] = useState(false);

  const selected = rows.filter((r) => r.selected && parseMoney(r.amount));
  const nameOf = (id: string) => FREELANCERS.find((f) => f.id === id)?.name ?? 'Unknown';

  function update(id: string, patch: Partial<BatchRow>) {
    setRows((prev) => prev.map((r) => (r.freelancerId === id ? { ...r, ...patch } : r)));
  }

  function runCompliance() {
    setRows((prev) =>
      prev.map((r) => {
        const minor = parseMoney(r.amount);
        if (!r.selected || !minor) return { ...r, verdict: undefined };
        const payee = FREELANCERS.find((f) => f.id === r.freelancerId)!;
        const dstMinor = Math.round(minor * 90.24);
        const result = evaluateCompliance({
          payee,
          srcCurrency: 'EUR',
          srcAmountMinor: minor,
          dstCurrency: 'INR',
          dstAmountMinor: dstMinor,
          purposeCode: 'P0802' as PurposeCode,
        });
        return { ...r, verdict: result.verdict };
      }),
    );
    setRan(true);
  }

  async function confirmAll() {
    setBusy(true);
    for (const r of rows) {
      const minor = parseMoney(r.amount);
      if (!r.selected || !minor || r.verdict === 'REJECT') continue;
      try {
        const created = await gateway.createPayment({
          payeeId: r.freelancerId,
          srcCurrency: 'EUR',
          dstCurrency: 'INR',
          srcAmountMinor: minor,
          purposeCode: 'P0802' as PurposeCode,
        });
        update(r.freelancerId, { paymentId: created.id });
      } catch {
        /* per-row failure stays visible via missing paymentId */
      }
    }
    setBusy(false);
  }

  const pair = pairOf('EUR', 'INR');

  return (
    <Panel className="p-4">
      <p className="text-[13px] text-muted mb-4">
        Select payees, set an amount for each in {pair.slice(0, 3)}, run one compliance pass across all rows, then confirm once.
      </p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className="label h-9 px-3 text-left font-normal w-[40px]"></th>
            <th className="label h-9 px-3 text-left font-normal">Payee</th>
            <th className="label h-9 px-3 text-right font-normal">Amount EUR</th>
            <th className="label h-9 px-3 text-right font-normal">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.freelancerId} className="border-b border-line h-12">
              <td className="px-3">
                <input
                  type="checkbox"
                  checked={r.selected}
                  onChange={(e) => update(r.freelancerId, { selected: e.target.checked })}
                  aria-label={`Select ${nameOf(r.freelancerId)}`}
                  className="accent-[var(--color-accent)]"
                />
              </td>
              <td className="px-3 text-[13px] text-text">{nameOf(r.freelancerId)}</td>
              <td className="px-3 text-right">
                <Input
                  value={r.amount}
                  onChange={(e) => update(r.freelancerId, { amount: e.target.value, verdict: undefined })}
                  disabled={!r.selected}
                  inputMode="decimal"
                  className="num h-7 w-[120px] ml-auto text-right"
                  placeholder="0.00"
                />
              </td>
              <td className="px-3 text-right text-[12px]">
                {r.paymentId ? (
                  <span className="text-ok">Sent</span>
                ) : r.verdict ? (
                  <span className={VERDICT_STYLE[r.verdict]}>{r.verdict === 'APPROVE' ? 'Cleared' : r.verdict === 'FLAG' ? 'Flagged' : 'Rejected'}</span>
                ) : (
                  <span className="text-faint">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[12px] text-muted num">
          {selected.length} selected, {formatMoney(selected.reduce((s, r) => s + (parseMoney(r.amount) ?? 0), 0), 'EUR')}
        </span>
        <div className="flex gap-2">
          <Button variant="default" size="sm" disabled={selected.length === 0} onClick={runCompliance}>Run compliance</Button>
          <Button variant="primary" size="sm" disabled={!ran || busy || selected.every((r) => r.verdict === 'REJECT')} onClick={confirmAll}>
            {busy ? 'Sending' : 'Confirm all'}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
