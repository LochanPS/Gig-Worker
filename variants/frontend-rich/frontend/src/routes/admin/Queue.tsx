import { useEffect, useMemo, useState } from 'react';
import type { Payment, Verdict } from '@gigbridge/shared';
import { gateway } from '@/lib/gateway';
import { FREELANCERS } from '@/lib/directory';
import { evaluateCompliance } from '@/lib/compliance';
import { formatMoney } from '@/lib/money';
import { relativeAge } from '@/lib/format';
import { payeeName, corridorLabel } from '@/lib/paymentView';
import { PageHeader } from '@/components/PageHeader';
import { Panel, Button, Textarea } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { StatusChip, SeverityChip } from '@/components/StatusChip';
import { Money } from '@/components/Money';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Check, X } from '@phosphor-icons/react';

// Seeded flagged cases so the queue is demonstrable while the mock persists none.
// Amounts are chosen to actually trip a rule (EU EDD threshold / pending PAN).
function seedFlagged(): Payment[] {
  const mk = (id: string, freelancerId: string, srcMinor: number): Payment => ({
    id,
    companyId: '11111111-1111-1111-1111-111111111111',
    freelancerId,
    srcCurrency: 'EUR',
    dstCurrency: 'INR',
    srcAmountMinor: srcMinor,
    dstAmountMinor: Math.round(srcMinor * 90.24),
    feeAmountMinor: Math.max(Math.round(srcMinor * 0.0075), 100),
    fxRateId: 'fx-1',
    purposeCode: 'P0802',
    invoiceRef: null,
    state: 'FLAGGED',
    escrowId: null,
    complianceDecisionId: null,
    txHashFund: null,
    txHashRelease: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    updatedAt: new Date().toISOString(),
    timeline: [
      { key: 'CREATED', label: 'Payment created', state: 'DRAFT', at: new Date(Date.now() - 1000 * 60 * 42).toISOString(), actor: 'Novatek GmbH' },
      { key: 'COMPLIANCE_APPROVED', label: 'Compliance review', state: 'FLAGGED', at: new Date(Date.now() - 1000 * 60 * 41).toISOString(), actor: 'Agent' },
    ],
  });
  return [mk('flag-0001', FREELANCERS[0].id, 1_240_000), mk('flag-0002', FREELANCERS[2].id, 62_000_00)];
}

export function AdminQueue() {
  const { push } = useToast();
  const [cases, setCases] = useState<Payment[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [docsRequested, setDocsRequested] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    gateway
      .adminQueue()
      .then((server) => {
        if (cancelled) return;
        const list = server.length ? server : seedFlagged();
        setCases(list);
        setSelected(list[0]?.id ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        const list = seedFlagged();
        setCases(list);
        setSelected(list[0]?.id ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const current = useMemo(() => cases?.find((c) => c.id === selected) ?? null, [cases, selected]);
  const compliance = useMemo(() => {
    if (!current) return null;
    const payee = FREELANCERS.find((f) => f.id === current.freelancerId);
    if (!payee || !current.purposeCode) return null;
    return evaluateCompliance({
      payee,
      srcCurrency: current.srcCurrency,
      srcAmountMinor: current.srcAmountMinor,
      dstCurrency: current.dstCurrency,
      dstAmountMinor: current.dstAmountMinor ?? 0,
      purposeCode: current.purposeCode,
    });
  }, [current]);

  const triggerRule = (p: Payment): string => {
    const payee = FREELANCERS.find((f) => f.id === p.freelancerId);
    if (!payee || !p.purposeCode) return 'Review';
    const c = evaluateCompliance({
      payee,
      srcCurrency: p.srcCurrency,
      srcAmountMinor: p.srcAmountMinor,
      dstCurrency: p.dstCurrency,
      dstAmountMinor: p.dstAmountMinor ?? 0,
      purposeCode: p.purposeCode,
    });
    return c.ruleResults.find((r) => !r.passed)?.ruleId ?? 'Manual review';
  };

  async function resolve(action: 'APPROVE' | 'REJECT') {
    if (!current) return;
    setBusy(true);
    // Optimistic removal, then reconcile with the server.
    const id = current.id;
    setCases((prev) => (prev ? prev.filter((c) => c.id !== id) : prev));
    try {
      await gateway.resolveCase(id, action, note);
    } catch {
      /* server reconciliation is a no-op in the mock */
    } finally {
      setBusy(false);
      setDialog(null);
      setNote('');
      push(action === 'APPROVE' ? 'Case approved, payment resumed' : 'Case rejected');
      setCases((prev) => {
        const next = prev ?? [];
        setSelected(next[0]?.id ?? null);
        return next;
      });
    }
  }

  const recommended: Verdict = compliance?.verdict ?? 'FLAG';

  return (
    <>
      <PageHeader title="Review queue" />
      <div className="grid lg:grid-cols-12 gap-5">
        <Panel className="lg:col-span-4">
          <div className="border-b border-line px-4 h-12 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Flagged cases</h2>
            <span className="num text-[11px] text-faint">{cases?.length ?? 0}</span>
          </div>
          {cases && cases.length === 0 ? (
            <EmptyState title="Queue clear" body="No payments are waiting for review. Flagged transfers land here for a decision." />
          ) : (
            <ul className="divide-y divide-line">
              {(cases ?? []).map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelected(c.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${selected === c.id ? 'bg-raised' : 'hover:bg-raised'}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[13px] text-text">{payeeName(c)}</span>
                      <Money minor={c.srcAmountMinor} currency={c.srcCurrency} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="num text-[11px] text-warn">{triggerRule(c)}</span>
                      <span className="text-[11px] text-faint">{relativeAge(c.createdAt)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="lg:col-span-8">
          {current ? (
            <Panel className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-[16px]">{payeeName(current)}</h2>
                  <p className="text-[12px] text-faint num">{corridorLabel(current)} · Reference {current.id.slice(0, 8)}</p>
                </div>
                <StatusChip state={current.state} />
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                <Cell label="Amount" value={formatMoney(current.srcAmountMinor, current.srcCurrency)} />
                <Cell label="Payee receives" value={formatMoney(current.dstAmountMinor, current.dstCurrency)} />
                <Cell label="Purpose" value={current.purposeCode ?? '-'} />
              </dl>

              <div className="label mb-3">Rules evaluated</div>
              <div className="flex flex-col gap-2 mb-6">
                {compliance?.ruleResults.map((r) => (
                  <div key={r.ruleId} className="flex items-start gap-3 border border-line bg-bg px-3 py-2.5">
                    <span className={`mt-0.5 ${r.passed ? 'text-ok' : 'text-danger'}`}>{r.passed ? <Check size={15} /> : <X size={15} />}</span>
                    <span className="num text-[11px] text-muted w-[92px] shrink-0 pt-0.5">{r.ruleId}</span>
                    <span className="flex-1">
                      <span className="text-[12px] text-text">{r.message}</span>
                      <span className="block text-[11px] text-faint mt-0.5">{r.legalRef}</span>
                    </span>
                    <SeverityChip severity={r.severity === 'BLOCK' ? 'HIGH' : r.severity === 'FLAG' ? 'MEDIUM' : 'LOW'} />
                  </div>
                ))}
              </div>

              <div className="border border-line bg-bg p-4 mb-6">
                <div className="label mb-2">Agent summary</div>
                <p className="text-[13px] text-muted leading-[1.6]">{compliance?.agentExplanation}</p>
                <p className="text-[12px] text-text mt-3">
                  Recommended action: <span className={recommended === 'REJECT' ? 'text-danger' : recommended === 'FLAG' ? 'text-warn' : 'text-ok'}>{recommended === 'REJECT' ? 'Reject' : 'Review, likely approve'}</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  size="sm"
                  disabled={docsRequested[current.id]}
                  onClick={() => {
                    setDocsRequested((prev) => ({ ...prev, [current.id]: true }));
                    push('Documents requested from payer');
                  }}
                >
                  {docsRequested[current.id] ? 'Documents requested' : 'Request documents'}
                </Button>
                <Button variant="primary" size="sm" onClick={() => setDialog('APPROVE')}>Approve</Button>
                <Button variant="danger" size="sm" onClick={() => setDialog('REJECT')}>Reject</Button>
              </div>
            </Panel>
          ) : (
            <Panel>
              <EmptyState title="Select a case" body="Choose a flagged payment on the left to see its rule hits and take a decision." />
            </Panel>
          )}
        </div>
      </div>

      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === 'APPROVE' ? 'Approve payment' : 'Reject payment'}
        footer={
          <>
            <Button variant="quiet" size="sm" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant={dialog === 'APPROVE' ? 'primary' : 'danger'}
              size="sm"
              disabled={note.trim().length < 10 || busy}
              onClick={() => dialog && resolve(dialog)}
            >
              {busy ? 'Saving' : dialog === 'APPROVE' ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        <label htmlFor="note" className="label mb-2 block">Decision note</label>
        <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Record the reasoning for this decision, at least ten characters" />
        {note.trim().length > 0 && note.trim().length < 10 ? (
          <p className="text-[11px] text-danger mt-2">A note of at least ten characters is required.</p>
        ) : null}
      </Modal>
    </>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label text-[10px] mb-1">{label}</div>
      <div className="num text-[13px] text-text">{value}</div>
    </div>
  );
}
