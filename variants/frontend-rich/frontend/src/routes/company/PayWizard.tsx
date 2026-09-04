import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, X, MagnifyingGlass, Warning } from '@phosphor-icons/react';
import type { Currency, FxQuote, Payment, PurposeCode, RuleResult } from '@gigbridge/shared';
import { PURPOSE_CODES, PURPOSE_CODE_LABELS } from '@gigbridge/shared';
import { FREELANCERS, freelancerById, type DirectoryFreelancer } from '@/lib/directory';
import { gateway } from '@/lib/gateway';
import { parseMoney, formatMoney, pairOf } from '@/lib/money';
import { evaluateCompliance, type ComplianceResult } from '@/lib/compliance';
import { countryName } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { Button, Field, Input, Select, Panel } from '@/components/ui/primitives';
import { VerifiedChip } from '@/components/StatusChip';
import { Money } from '@/components/Money';
import { QuoteCard } from '@/components/QuoteCard';
import { FeeBreakdown } from '@/components/FeeBreakdown';
import { AgentReasoningPanel } from '@/components/AgentReasoningPanel';
import { RateLockRing } from '@/components/RateLockRing';

const CURRENCIES: Currency[] = ['EUR', 'USD', 'INR'];
const RATE: Record<string, number> = {
  EURINR: 90.24, USDINR: 83.1, INRUSD: 0.012, EURUSD: 1.08, USDEUR: 0.92, INREUR: 0.0111, EUREUR: 1, USDUSD: 1, INRINR: 1,
};

type Dir = 1 | -1;

interface NavState {
  payeeId?: string;
  startStep?: number;
  amountMinor?: number;
  invoiceRef?: string;
}

export function PayWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
  const nav = (location.state ?? {}) as NavState;

  const [step, setStep] = useState(1);
  const [dir, setDir] = useState<Dir>(1);
  const [payee, setPayee] = useState<DirectoryFreelancer | null>(null);
  const [query, setQuery] = useState('');

  const [srcCurrency, setSrcCurrency] = useState<Currency>('EUR');
  const [dstCurrency, setDstCurrency] = useState<Currency>('INR');
  const [srcInput, setSrcInput] = useState('');
  const [dstInput, setDstInput] = useState('');
  const editing = useRef<'src' | 'dst'>('src');
  const [quote, setQuote] = useState<FxQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [purposeCode, setPurposeCode] = useState<PurposeCode | ''>('');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [agentDone, setAgentDone] = useState(false);
  const [posting, setPosting] = useState(false);

  const [confirmExpired, setConfirmExpired] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const go = useCallback((next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  }, [step]);

  // Deep link: land on step 2 with a preselected payee (from roster / invoice).
  useEffect(() => {
    if (nav.payeeId) {
      const f = freelancerById(nav.payeeId);
      if (f) {
        setPayee(f);
        if (nav.amountMinor) {
          setSrcInput((nav.amountMinor / 100).toString());
          editing.current = 'src';
        }
        setStep(nav.startStep ?? 2);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pair = pairOf(srcCurrency, dstCurrency);

  // Debounced bidirectional quote.
  useEffect(() => {
    if (step !== 2) return;
    const rate = quote?.midRate ?? RATE[pair] ?? 1;
    let srcMinor: number | null;
    if (editing.current === 'src') srcMinor = parseMoney(srcInput);
    else {
      const dstMinor = parseMoney(dstInput);
      srcMinor = dstMinor && rate ? Math.round(dstMinor / rate) : null;
    }
    if (!srcMinor || srcMinor <= 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    setQuoteLoading(true);
    setQuoteError(null);
    const t = window.setTimeout(async () => {
      try {
        const q = await gateway.getQuote(pair, srcMinor);
        setQuote(q);
        if (editing.current === 'src') setDstInput((q.payeeReceivesMinor / 100).toString());
        else setSrcInput((q.srcAmountMinor / 100).toString());
      } catch (err) {
        setQuoteError(err instanceof Error ? err.message : 'Could not fetch a quote.');
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcInput, dstInput, pair, step]);

  // Step 3: create the payment and evaluate compliance once a purpose code is picked.
  const runCompliance = useCallback(
    async (code: PurposeCode) => {
      if (!payee || !quote) return;
      setPosting(true);
      setCompliance(null);
      setRevealed(0);
      setAgentDone(false);
      const result = evaluateCompliance({
        payee,
        srcCurrency,
        srcAmountMinor: quote.srcAmountMinor,
        dstCurrency,
        dstAmountMinor: quote.payeeReceivesMinor,
        purposeCode: code,
      });
      try {
        const created = await gateway.createPayment({
          payeeId: payee.id,
          srcCurrency,
          dstCurrency,
          srcAmountMinor: quote.srcAmountMinor,
          purposeCode: code,
          invoiceRef: nav.invoiceRef ?? null,
        });
        setPayment(created);
      } catch {
        // Even if persistence fails, show the evaluation so the demo continues.
      } finally {
        setPosting(false);
        setCompliance(result);
      }
    },
    [payee, quote, srcCurrency, dstCurrency, nav.invoiceRef],
  );

  // Stagger the checklist rows.
  useEffect(() => {
    if (!compliance) return;
    if (reduce) {
      setRevealed(compliance.ruleResults.length);
      return;
    }
    setRevealed(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setRevealed(i);
      if (i >= compliance.ruleResults.length) window.clearInterval(id);
    }, 180);
    return () => window.clearInterval(id);
  }, [compliance, reduce]);

  const checklistDone = compliance ? revealed >= compliance.ruleResults.length : false;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? FREELANCERS.filter((f) => f.name.toLowerCase().includes(q) || f.country.toLowerCase().includes(q)) : FREELANCERS;
  }, [query]);

  async function confirmPayment() {
    if (!payment || !quote) return;
    setConfirming(true);
    try {
      await gateway.confirmPayment(payment.id, quote.quoteId);
      navigate(`/company/payments/${payment.id}`);
    } catch {
      setConfirming(false);
    }
  }

  const slide = (d: Dir) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, x: d * 24 },
    animate: { opacity: 1, x: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, x: d * -24 },
    transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <>
      <PageHeader title="New payout" subtitle="Select a payee, price the transfer, clear compliance, then confirm against the locked rate." />

      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8">
          <Panel className="p-6 min-h-[440px] overflow-hidden">
            <StepDots step={step} />
            <AnimatePresence mode="wait" initial={false}>
              {step === 1 ? (
                <motion.div key="s1" {...slide(dir)}>
                  <h2 className="text-[16px] mb-4">Who are you paying?</h2>
                  <div className="flex items-center gap-2 border border-line bg-bg px-2.5 h-9 mb-3">
                    <MagnifyingGlass size={15} className="text-faint" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search freelancers"
                      className="bg-transparent text-[13px] w-full focus:outline-none"
                      aria-label="Search freelancers"
                    />
                  </div>
                  <ul className="flex flex-col border border-line divide-y divide-line">
                    {filtered.map((f) => (
                      <li key={f.id}>
                        <button
                          onClick={() => {
                            setPayee(f);
                            go(2);
                          }}
                          className="w-full flex items-center justify-between gap-3 px-3 h-14 text-left hover:bg-raised transition-colors"
                        >
                          <span className="flex flex-col">
                            <span className="text-[13px] text-text">{f.name}</span>
                            <span className="text-[12px] text-faint">{countryName(f.country)}</span>
                          </span>
                          <VerifiedChip status={f.kycStatus} />
                        </button>
                      </li>
                    ))}
                    {filtered.length === 0 ? (
                      <li className="px-3 py-6 text-[13px] text-muted text-center">No freelancers match that search.</li>
                    ) : null}
                  </ul>
                  {payee && payee.kycStatus !== 'VERIFIED' ? (
                    <p className="mt-3 text-[12px] text-warn flex items-center gap-2">
                      <Warning size={14} /> {payee.name} is not yet verified. Verification is required before settlement.
                    </p>
                  ) : null}
                </motion.div>
              ) : null}

              {step === 2 ? (
                <motion.div key="s2" {...slide(dir)}>
                  <h2 className="text-[16px] mb-4">Amount</h2>
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <Field label="You send" htmlFor="src">
                      <div className="flex gap-2">
                        <Select value={srcCurrency} onChange={(e) => setSrcCurrency(e.target.value as Currency)} className="w-[92px]">
                          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </Select>
                        <Input
                          id="src"
                          inputMode="decimal"
                          className="num"
                          value={srcInput}
                          onChange={(e) => {
                            editing.current = 'src';
                            setSrcInput(e.target.value);
                          }}
                          placeholder="0.00"
                        />
                      </div>
                    </Field>
                    <Field label="Payee receives" htmlFor="dst">
                      <div className="flex gap-2">
                        <Select value={dstCurrency} onChange={(e) => setDstCurrency(e.target.value as Currency)} className="w-[92px]">
                          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </Select>
                        <Input
                          id="dst"
                          inputMode="decimal"
                          className="num"
                          value={dstInput}
                          onChange={(e) => {
                            editing.current = 'dst';
                            setDstInput(e.target.value);
                          }}
                          placeholder="0.00"
                        />
                      </div>
                    </Field>
                  </div>

                  {quoteLoading ? <p className="text-[13px] text-muted py-6 text-center">Fetching live quote</p> : null}
                  {quoteError ? <p className="text-[13px] text-danger py-2">{quoteError}</p> : null}
                  {quote && !quoteLoading ? (
                    <div className="grid gap-4">
                      <QuoteCard quote={quote} srcCurrency={srcCurrency} dstCurrency={dstCurrency} />
                      <FeeBreakdown quote={quote} srcCurrency={srcCurrency} />
                    </div>
                  ) : null}

                  <div className="mt-6 flex items-center justify-between">
                    <Button variant="quiet" onClick={() => go(1)}>Back</Button>
                    <Button variant="primary" disabled={!quote || quoteLoading} onClick={() => go(3)}>Continue</Button>
                  </div>
                </motion.div>
              ) : null}

              {step === 3 ? (
                <motion.div key="s3" {...slide(dir)}>
                  <h2 className="text-[16px] mb-4">Compliance</h2>
                  <Field label="Purpose of payment" htmlFor="purpose">
                    <Select
                      id="purpose"
                      value={purposeCode}
                      onChange={(e) => {
                        const code = e.target.value as PurposeCode;
                        setPurposeCode(code);
                        if (code) void runCompliance(code);
                      }}
                    >
                      <option value="">Select a purpose code</option>
                      {PURPOSE_CODES.map((c) => (
                        <option key={c} value={c}>{c} - {PURPOSE_CODE_LABELS[c]}</option>
                      ))}
                    </Select>
                  </Field>

                  {posting && !compliance ? (
                    <p className="text-[13px] text-muted py-6">The agent is evaluating rules across both jurisdictions</p>
                  ) : null}

                  {compliance ? (
                    <div className="mt-5 flex flex-col gap-2">
                      {compliance.ruleResults.slice(0, revealed).map((r) => (
                        <RuleRow key={r.ruleId} rule={r} reduce={!!reduce} />
                      ))}
                    </div>
                  ) : null}

                  {compliance && checklistDone ? (
                    <div className="mt-5">
                      <AgentReasoningPanel text={compliance.agentExplanation} onDone={() => setAgentDone(true)} />
                    </div>
                  ) : null}

                  {compliance && checklistDone && agentDone ? (
                    <Verdict
                      compliance={compliance}
                      paymentId={payment?.id}
                      onContinue={() => go(4)}
                      onRestart={() => {
                        setCompliance(null);
                        setPurposeCode('');
                        setPayment(null);
                        setAgentDone(false);
                        go(1);
                      }}
                      onDetail={() => payment && navigate(`/company/payments/${payment.id}`)}
                    />
                  ) : null}

                  {!compliance ? (
                    <div className="mt-6">
                      <Button variant="quiet" onClick={() => go(2)}>Back</Button>
                    </div>
                  ) : null}
                </motion.div>
              ) : null}

              {step === 4 && quote && payee ? (
                <motion.div key="s4" {...slide(dir)}>
                  <h2 className="text-[16px] mb-4">Confirm</h2>
                  <div className="grid sm:grid-cols-2 gap-6 items-start">
                    <dl className="flex flex-col gap-2.5">
                      <SummaryRow label="Payee" value={payee.name} />
                      <SummaryRow label="Corridor" value={`${srcCurrency} to ${dstCurrency}`} mono />
                      <SummaryRow label="You send" value={formatMoney(quote.srcAmountMinor, srcCurrency)} mono />
                      <SummaryRow label="Payee receives" value={formatMoney(quote.payeeReceivesMinor, dstCurrency)} mono />
                      <SummaryRow label="Rate" value={`1 ${srcCurrency} = ${quote.midRate.toFixed(4)} ${dstCurrency}`} mono />
                      <SummaryRow label="Fee" value={formatMoney(quote.feeMinor, srcCurrency)} mono />
                      <SummaryRow label="Purpose" value={purposeCode ? `${purposeCode}` : '-'} mono />
                    </dl>
                    <div className="flex flex-col items-center gap-4">
                      <RateLockRing expiresAt={quote.expiresAt} onExpire={() => setConfirmExpired(true)} />
                      {confirmExpired ? (
                        <Button variant="default" onClick={() => { setConfirmExpired(false); go(2); }}>Request new quote</Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <Button variant="quiet" onClick={() => go(3)}>Back</Button>
                    <Button variant="primary" disabled={confirmExpired || confirming} onClick={confirmPayment}>
                      {confirming ? 'Confirming' : 'Confirm and pay'}
                    </Button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Panel>
        </div>

        <SummaryRail
          payee={payee}
          srcCurrency={srcCurrency}
          dstCurrency={dstCurrency}
          quote={quote}
          purposeCode={purposeCode || null}
        />
      </div>
    </>
  );
}

function StepDots({ step }: { step: number }) {
  const labels = ['Payee', 'Amount', 'Compliance', 'Confirm'];
  return (
    <ol className="flex items-center gap-2 mb-6">
      {labels.map((l, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <li key={l} className="flex items-center gap-2">
            <span className={`num text-[11px] h-5 w-5 flex items-center justify-center border ${active ? 'border-accent text-accent' : done ? 'border-ok text-ok' : 'border-line text-faint'}`}>{n}</span>
            <span className={`text-[12px] ${active ? 'text-text' : 'text-faint'}`}>{l}</span>
            {n < 4 ? <span className="w-6 h-px bg-line" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function RuleRow({ rule, reduce }: { rule: RuleResult; reduce: boolean }) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="flex items-start gap-3 border border-line bg-bg px-3 py-2.5"
    >
      <span className={`mt-0.5 ${rule.passed ? 'text-ok' : 'text-danger'}`}>
        {rule.passed ? <Check size={15} /> : <X size={15} />}
      </span>
      <span className="num text-[11px] text-muted w-[92px] shrink-0 pt-0.5">{rule.ruleId}</span>
      <span className="flex-1">
        <span className="text-[12px] text-text leading-[1.5]">{rule.message}</span>
        <span className="block text-[11px] text-faint mt-0.5">{rule.legalRef}</span>
      </span>
    </motion.div>
  );
}

function Verdict({
  compliance,
  paymentId,
  onContinue,
  onRestart,
  onDetail,
}: {
  compliance: ComplianceResult;
  paymentId?: string;
  onContinue: () => void;
  onRestart: () => void;
  onDetail: () => void;
}) {
  if (compliance.verdict === 'APPROVE') {
    return (
      <div className="mt-5 border border-ok bg-ok/8 p-4">
        <div className="text-[13px] text-text mb-1">Compliance cleared</div>
        <p className="text-[12px] text-muted mb-3">All rules passed across both jurisdictions. You can lock the rate and confirm.</p>
        <Button variant="primary" onClick={onContinue}>Continue to confirm</Button>
      </div>
    );
  }
  if (compliance.verdict === 'FLAG') {
    const flag = compliance.ruleResults.find((r) => r.severity === 'FLAG' && !r.passed);
    return (
      <div className="mt-5 border border-warn bg-warn/8 p-4">
        <div className="text-[13px] text-text mb-1">Entered manual review</div>
        <p className="text-[12px] text-muted mb-1">This payment has been routed to the compliance queue under {flag?.legalRef}.</p>
        {paymentId ? <p className="text-[11px] text-faint num mb-3">Reference {paymentId.slice(0, 8)}</p> : null}
        <Button variant="default" onClick={onDetail}>View payment</Button>
      </div>
    );
  }
  const block = compliance.ruleResults.find((r) => r.severity === 'BLOCK' && !r.passed);
  return (
    <div className="mt-5 border border-danger bg-danger/8 p-4">
      <div className="text-[13px] text-text mb-1">Payment rejected</div>
      <p className="text-[12px] text-muted mb-1">{block?.message}</p>
      <p className="text-[11px] text-faint mb-3">Blocked under {block?.legalRef}.</p>
      <Button variant="default" onClick={onRestart}>Start over</Button>
    </div>
  );
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={`text-right text-[13px] text-text ${mono ? 'num' : ''}`}>{value}</dd>
    </div>
  );
}

function SummaryRail({
  payee,
  srcCurrency,
  dstCurrency,
  quote,
  purposeCode,
}: {
  payee: DirectoryFreelancer | null;
  srcCurrency: string;
  dstCurrency: string;
  quote: FxQuote | null;
  purposeCode: string | null;
}) {
  return (
    <div className="lg:col-span-4">
      <Panel className="p-4 sticky top-4">
        <div className="label mb-3">Payout summary</div>
        <dl className="flex flex-col gap-2.5">
          <SummaryRow label="Payee" value={payee?.name ?? 'Not selected'} />
          <SummaryRow label="Corridor" value={`${srcCurrency} to ${dstCurrency}`} mono />
          <SummaryRow label="You send" value={quote ? formatMoney(quote.srcAmountMinor, srcCurrency) : '-'} mono />
          <SummaryRow label="Fee" value={quote ? formatMoney(quote.feeMinor, srcCurrency) : '-'} mono />
          <SummaryRow label="Purpose" value={purposeCode ?? '-'} mono />
        </dl>
        {quote ? (
          <div className="mt-4 pt-4 border-t border-line">
            <div className="label mb-1.5">Payee receives</div>
            <Money minor={quote.payeeReceivesMinor} currency={dstCurrency} size="lg" className="text-ok" />
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
