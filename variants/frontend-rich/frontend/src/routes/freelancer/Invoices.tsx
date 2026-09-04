import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Currency } from '@gigbridge/shared';
import { COMPANIES } from '@/lib/directory';
import { gateway } from '@/lib/gateway';
import { parseMoney, formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { Panel, Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface RaisedInvoice {
  id: string;
  companyId: string;
  amountMinor: number;
  currency: Currency;
  memo: string;
  reference?: string;
  status: 'SENT' | 'APPROVED' | 'PAID';
  paymentId?: string;
  createdAt: string;
}

const SEED: RaisedInvoice[] = [
  { id: 'inv-3001', companyId: COMPANIES[0].id, amountMinor: 50000, currency: 'EUR', memo: 'Landing page build', status: 'PAID', paymentId: 'aaaaaaa1-0000-0000-0000-000000000001', createdAt: '2026-08-28T10:00:00Z' },
  { id: 'inv-3002', companyId: COMPANIES[0].id, amountMinor: 80000, currency: 'EUR', memo: 'Design system tokens', status: 'APPROVED', createdAt: '2026-09-01T10:00:00Z' },
];

const STAGES = ['Sent', 'Approved', 'Paid'] as const;

export function FreelancerInvoices() {
  const navigate = useNavigate();
  const { push } = useToast();
  const [list, setList] = useState<RaisedInvoice[]>(SEED);
  const [companyId, setCompanyId] = useState(COMPANIES[0].id);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [memo, setMemo] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const minor = parseMoney(amount);
    if (!minor || !memo.trim()) return;
    setBusy(true);
    try {
      const res = await gateway.createInvoice({ companyId, amountMinor: minor, currency, memo, reference: reference || undefined });
      const invoice: RaisedInvoice = {
        id: res.id ?? `inv-${Date.now()}`,
        companyId,
        amountMinor: minor,
        currency,
        memo,
        reference: reference || undefined,
        status: 'SENT',
        createdAt: new Date().toISOString(),
      };
      setList((prev) => [invoice, ...prev]);
      push('Invoice sent to ' + (COMPANIES.find((c) => c.id === companyId)?.name ?? 'company'));
      setAmount('');
      setMemo('');
      setReference('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Invoices" />
      <div className="grid lg:grid-cols-12 gap-5">
        <Panel className="lg:col-span-5 p-5">
          <h2 className="text-[15px] mb-4">Raise an invoice</h2>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Company" htmlFor="company">
              <Select id="company" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                {COMPANIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-[1fr_92px] gap-3">
              <Field label="Amount" htmlFor="amount">
                <Input id="amount" inputMode="decimal" className="num" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              </Field>
              <Field label="Currency" htmlFor="currency">
                <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                  {(['EUR', 'USD', 'INR'] as Currency[]).map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Memo" htmlFor="memo">
              <Textarea id="memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What is this invoice for" />
            </Field>
            <Field label="Reference" hint="Optional purchase order or project code." htmlFor="ref">
              <Input id="ref" className="num" value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
            <Button type="submit" variant="primary" disabled={busy || !parseMoney(amount) || !memo.trim()}>
              {busy ? 'Sending' : 'Send invoice'}
            </Button>
          </form>
        </Panel>

        <Panel className="lg:col-span-7">
          <div className="border-b border-line px-4 h-12 flex items-center">
            <h2 className="text-[13px] font-medium">Raised invoices</h2>
          </div>
          <ul className="divide-y divide-line">
            {list.map((inv) => {
              const stage = inv.status === 'PAID' ? 2 : inv.status === 'APPROVED' ? 1 : 0;
              return (
                <li key={inv.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="text-[13px] text-text">{COMPANIES.find((c) => c.id === inv.companyId)?.name}</div>
                      <div className="text-[12px] text-faint">{inv.memo} · {formatDate(inv.createdAt)}</div>
                    </div>
                    <div className="num text-[14px] text-text">{formatMoney(inv.amountMinor, inv.currency)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {STAGES.map((label, i) => (
                      <div key={label} className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-[11px] uppercase tracking-[0.06em]',
                            i <= stage ? 'text-ok' : 'text-faint',
                          )}
                        >
                          {label}
                        </span>
                        {i < STAGES.length - 1 ? <span className={cn('w-8 h-px', i < stage ? 'bg-ok' : 'bg-line')} /> : null}
                      </div>
                    ))}
                    {inv.status === 'PAID' && inv.paymentId ? (
                      <Button size="sm" variant="quiet" className="ml-auto" onClick={() => navigate(`/company/payments/${inv.paymentId}`)}>
                        View payment
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </>
  );
}
