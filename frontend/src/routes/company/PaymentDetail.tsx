import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Payment } from '@gigbridge/shared';
import { useAsync } from '@/lib/useAsync';
import { gateway } from '@/lib/gateway';
import { useLivePayment } from '@/lib/realtime';
import { freelancerById } from '@/lib/directory';
import { evaluateCompliance } from '@/lib/compliance';
import { formatMoney } from '@/lib/money';
import { formatDateTime } from '@/lib/format';
import { corridorLabel, payeeName } from '@/lib/paymentView';
import { makeTextPdf, downloadBlob } from '@/lib/pdf';
import { PageHeader } from '@/components/PageHeader';
import { Panel, Button, Textarea } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { StatusChip } from '@/components/StatusChip';
import { PaymentTimeline } from '@/components/PaymentTimeline';
import { Money } from '@/components/Money';
import { Async } from '@/components/ui/states';

export function PaymentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const state = useAsync<Payment>(() => gateway.getPayment(id!), [id]);
  const live = useLivePayment(id);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  const payment = state.data;
  // Live socket/poll updates win over the server-rendered copy.
  const merged: Payment | null = useMemo(() => {
    if (!payment) return null;
    if (live && live.paymentId === payment.id) {
      return { ...payment, state: live.state, timeline: live.timeline.length ? live.timeline : payment.timeline };
    }
    return payment;
  }, [payment, live]);

  const compliance = useMemo(() => {
    if (!merged) return null;
    const payee = freelancerById(merged.freelancerId);
    if (!payee || !merged.purposeCode) return null;
    return evaluateCompliance({
      payee,
      srcCurrency: merged.srcCurrency,
      srcAmountMinor: merged.srcAmountMinor,
      dstCurrency: merged.dstCurrency,
      dstAmountMinor: merged.dstAmountMinor ?? 0,
      purposeCode: merged.purposeCode,
    });
  }, [merged]);

  function receipt(p: Payment) {
    downloadBlob(
      makeTextPdf('GigBridge payment receipt', [
        `Payment reference: ${p.id}`,
        `Date: ${formatDateTime(p.createdAt)}`,
        `Payee: ${payeeName(p)}`,
        `Corridor: ${corridorLabel(p)}`,
        `Amount sent: ${formatMoney(p.srcAmountMinor, p.srcCurrency)}`,
        `Payee received: ${formatMoney(p.dstAmountMinor, p.dstCurrency)}`,
        `Platform fee: ${formatMoney(p.feeAmountMinor, p.srcCurrency)}`,
        `Status: ${p.state}`,
        p.txHashRelease ? `Release tx: ${p.txHashRelease}` : '',
      ].filter(Boolean)),
      `receipt-${p.id.slice(0, 8)}.pdf`,
    );
  }

  function complianceReport(p: Payment) {
    const lines = ['Payment reference: ' + p.id, ''];
    if (compliance) {
      lines.push('Verdict: ' + compliance.verdict, '');
      for (const r of compliance.ruleResults) {
        lines.push(`${r.ruleId} [${r.passed ? 'PASS' : 'FAIL'}] ${r.legalRef}`);
        lines.push('  ' + r.message);
      }
      lines.push('', 'Agent reasoning:', compliance.agentExplanation);
    }
    downloadBlob(makeTextPdf('GigBridge compliance report', lines), `compliance-${p.id.slice(0, 8)}.pdf`);
  }

  async function doRefund() {
    if (!merged) return;
    setRefunding(true);
    try {
      await gateway.refundPayment(merged.id, reason);
      setRefundOpen(false);
      state.reload();
    } finally {
      setRefunding(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Payment"
        subtitle={id ? `Reference ${id.slice(0, 8)}` : undefined}
        action={<Button variant="quiet" onClick={() => navigate('/company')}>Back to overview</Button>}
      />
      <Async state={state} what="the payment" onRetry={state.reload}>
        {() =>
          merged ? (
            <div className="grid lg:grid-cols-12 gap-5">
              <Panel className="lg:col-span-8 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-[16px]">Settlement timeline</h2>
                  <StatusChip state={merged.state} />
                </div>
                <PaymentTimeline
                  timeline={merged.timeline}
                  framing="payer"
                  ruleResults={compliance?.ruleResults}
                  agentExplanation={compliance?.agentExplanation}
                />
              </Panel>

              <div className="lg:col-span-4 flex flex-col gap-5">
                <Panel className="p-4">
                  <div className="label mb-3">Summary</div>
                  <dl className="flex flex-col gap-2.5">
                    <Row label="Payee" value={payeeName(merged)} />
                    <Row label="Corridor" value={corridorLabel(merged)} mono />
                    <Row label="You sent" value={formatMoney(merged.srcAmountMinor, merged.srcCurrency)} mono />
                    <Row label="Payee received" value={formatMoney(merged.dstAmountMinor, merged.dstCurrency)} mono />
                    <Row label="Fee" value={formatMoney(merged.feeAmountMinor, merged.srcCurrency)} mono />
                  </dl>
                  <div className="mt-4 pt-4 border-t border-line">
                    <div className="label mb-1.5">Payee received</div>
                    <Money minor={merged.dstAmountMinor} currency={merged.dstCurrency} size="lg" className="text-ok" />
                  </div>
                </Panel>

                <Panel className="p-4">
                  <div className="label mb-3">Documents</div>
                  <div className="flex flex-col gap-2">
                    <Button variant="default" size="sm" onClick={() => receipt(merged)}>Receipt PDF</Button>
                    <Button variant="default" size="sm" onClick={() => complianceReport(merged)}>Compliance report PDF</Button>
                  </div>
                </Panel>

                <Panel className="p-4">
                  <div className="label mb-3">Actions</div>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={merged.state !== 'FUNDED'}
                    onClick={() => setRefundOpen(true)}
                  >
                    Refund payment
                  </Button>
                  {merged.state !== 'FUNDED' ? (
                    <p className="text-[11px] text-faint mt-2">A refund is only available while funds sit in escrow.</p>
                  ) : null}
                </Panel>
              </div>
            </div>
          ) : null
        }
      </Async>

      <Modal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title="Refund payment"
        footer={
          <>
            <Button variant="quiet" size="sm" onClick={() => setRefundOpen(false)}>Cancel</Button>
            <Button variant="danger" size="sm" disabled={reason.trim().length < 4 || refunding} onClick={doRefund}>
              {refunding ? 'Refunding' : 'Confirm refund'}
            </Button>
          </>
        }
      >
        <label htmlFor="reason" className="label mb-2 block">Reason for refund</label>
        <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="State why this payment is being refunded" />
        <p className="text-[11px] text-faint mt-2">The escrowed funds return to your settlement wallet.</p>
      </Modal>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={`text-right text-[13px] text-text ${mono ? 'num' : ''}`}>{value}</dd>
    </div>
  );
}
