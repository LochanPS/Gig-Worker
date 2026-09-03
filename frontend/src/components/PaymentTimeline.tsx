import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { RuleResult, TimelineStep } from '@gigbridge/shared';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { TxHashLink } from './TxHashLink';

// The canonical seven steps. Company-framed and payee-framed labels differ.
export const STEPS = [
  { key: 'CREATED', payer: 'Payment created', payee: 'Payment created' },
  { key: 'COMPLIANCE_APPROVED', payer: 'Compliance approved', payee: 'Compliance cleared' },
  { key: 'RATE_LOCKED', payer: 'FX rate locked', payee: 'Exchange rate locked' },
  { key: 'FUNDED', payer: 'Escrow funded on-chain', payee: 'Funds held in escrow' },
  { key: 'SETTLING', payer: 'Settling', payee: 'Settling to your wallet' },
  { key: 'RELEASED', payer: 'Released to payee', payee: 'Released to you' },
  { key: 'CREDITED', payer: 'Payee credited', payee: 'Credited to your balance' },
] as const;

export function PaymentTimeline({
  timeline,
  framing = 'payer',
  ruleResults,
  agentExplanation,
}: {
  timeline: TimelineStep[];
  framing?: 'payer' | 'payee';
  ruleResults?: RuleResult[];
  agentExplanation?: string | null;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<string | null>(null);
  const reached = new Map(timeline.map((t) => [t.key, t]));

  return (
    <ol className="flex flex-col">
      {STEPS.map((step, i) => {
        const hit = reached.get(step.key);
        const done = Boolean(hit);
        const last = i === STEPS.length - 1;
        const expandable = step.key === 'COMPLIANCE_APPROVED' && done && (ruleResults?.length || agentExplanation);

        return (
          <li key={step.key} className="grid grid-cols-[16px_1fr] gap-x-3">
            {/* rail */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'mt-[6px] h-[7px] w-[7px] border',
                  done ? 'border-ok bg-ok' : 'border-line-strong',
                )}
              />
              {!last ? (
                <div className="relative flex-1 w-px my-1 min-h-[26px]">
                  <div className={cn('absolute inset-0 w-px', done ? 'bg-line' : 'border-l border-dashed border-line')} />
                  {done ? (
                    <motion.div
                      className="absolute inset-x-0 top-0 w-px bg-ok origin-top"
                      initial={reduce ? false : { scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      style={{ bottom: 0 }}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* body */}
            <div className={cn('pb-5', last && 'pb-0')}>
              <motion.div
                initial={false}
                animate={{ color: done ? '#EDEDEF' : '#5A5A63' }}
                transition={{ duration: 0.35 }}
                className="text-[13px] leading-[1.35]"
              >
                {framing === 'payee' ? step.payee : step.payer}
              </motion.div>

              <div className="mt-1 flex items-center gap-3 flex-wrap">
                <span className="text-[11px] text-faint num">{hit ? formatDateTime(hit.at) : 'Pending'}</span>
                {hit?.actor ? <span className="text-[11px] text-faint">by {hit.actor}</span> : null}
                {hit?.txHash ? <TxHashLink hash={hit.txHash} /> : null}
                {expandable ? (
                  <button
                    type="button"
                    onClick={() => setOpen(open === step.key ? null : step.key)}
                    className="text-[11px] text-muted hover:text-text transition-colors"
                  >
                    {open === step.key ? 'Hide detail' : 'Show detail'}
                  </button>
                ) : null}
              </div>

              {expandable && open === step.key ? (
                <div className="mt-3 border border-line bg-bg p-3 flex flex-col gap-3">
                  {ruleResults?.length ? (
                    <div className="flex flex-col gap-2">
                      {ruleResults.map((r) => (
                        <div key={r.ruleId} className="flex items-start gap-3">
                          <span className="num text-[11px] text-muted w-[86px] shrink-0">{r.ruleId}</span>
                          <span className={cn('text-[11px] w-[52px] shrink-0', r.passed ? 'text-ok' : 'text-danger')}>
                            {r.passed ? 'Pass' : 'Fail'}
                          </span>
                          <span className="text-[12px] text-text flex-1">
                            {r.message}
                            <span className="block text-[11px] text-faint mt-0.5">{r.legalRef}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {agentExplanation ? (
                    <p className="text-[12px] text-muted leading-[1.55] border-t border-line pt-3">{agentExplanation}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
