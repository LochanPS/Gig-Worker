import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button, Field, Input, Select, Panel } from '@/components/ui/primitives';
import { CopyValue } from '@/components/TxHashLink';
import { Money } from '@/components/Money';
import { cn } from '@/lib/utils';

const STEPS = ['Legal entity', 'Jurisdiction', 'Wallet'];
const COUNTRIES = ['DE', 'IN', 'US', 'GB', 'FR', 'NL', 'SG', 'AE'];

function ProgressRail({ current }: { current: number }) {
  return (
    <ol className="flex flex-col gap-1">
      {STEPS.map((label, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <li key={label} className="flex items-center gap-3 h-9">
            <span
              className={cn(
                'num text-[11px] h-6 w-6 flex items-center justify-center border',
                active ? 'border-accent text-accent' : done ? 'border-ok text-ok' : 'border-line text-faint',
              )}
            >
              {i + 1}
            </span>
            <span className={cn('text-[13px]', active ? 'text-text' : done ? 'text-muted' : 'text-faint')}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function OnboardCompany() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [legalName, setLegalName] = useState(user?.name ?? '');
  const [regNumber, setRegNumber] = useState('');
  const [country, setCountry] = useState(user?.country ?? 'DE');
  const wallet = user?.walletAddress ?? '0xNovatek0000000000000000000000000000001';

  return (
    <div className="min-h-[100dvh] px-6 py-12 flex justify-center">
      <div className="w-full max-w-[820px]">
        <div className="text-[16px] font-medium tracking-[0.02em] mb-1">GigBridge</div>
        <h1 className="text-[26px] font-medium mb-8">Company onboarding</h1>
        <div className="grid md:grid-cols-[180px_1fr] gap-8">
          <ProgressRail current={step} />
          <Panel className="p-6 min-h-[320px] flex flex-col">
            {step === 0 ? (
              <div className="flex flex-col gap-5">
                <h2 className="text-[16px]">Legal entity</h2>
                <Field label="Registered legal name" htmlFor="legal">
                  <Input id="legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
                </Field>
                <Field label="Registration number" hint="Commercial register or equivalent." htmlFor="reg">
                  <Input id="reg" className="num" value={regNumber} onChange={(e) => setRegNumber(e.target.value)} placeholder="HRB 000000" />
                </Field>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="flex flex-col gap-5">
                <h2 className="text-[16px]">Jurisdiction</h2>
                <Field label="Country of registration" htmlFor="country">
                  <Select id="country" value={country} onChange={(e) => setCountry(e.target.value)}>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
                <p className="text-[13px] text-muted leading-[1.6]">
                  Your jurisdiction determines which compliance rules apply to every payout you send. The agent evaluates
                  both your rules and the payee's on each transfer.
                </p>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="flex flex-col gap-5">
                <h2 className="text-[16px]">Wallet provisioned</h2>
                <p className="text-[13px] text-muted leading-[1.6]">
                  A custodial settlement wallet has been provisioned and pre-funded with demo USDC so you can send a
                  payout immediately.
                </p>
                <div className="border border-line bg-bg p-4 flex flex-col gap-3">
                  <div>
                    <div className="label mb-1.5">Settlement wallet</div>
                    <CopyValue value={wallet} label={`${wallet.slice(0, 10)}...${wallet.slice(-4)}`} />
                  </div>
                  <div className="pt-3 border-t border-line">
                    <div className="label mb-1.5">Demo faucet balance</div>
                    <Money minor={5_000_00} currency="USD" size="lg" className="text-ok" />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-auto pt-6 flex items-center justify-between">
              {step > 0 ? <Button variant="quiet" onClick={() => setStep((s) => s - 1)}>Back</Button> : <span />}
              {step < 2 ? (
                <Button variant="primary" onClick={() => setStep((s) => s + 1)}>Continue</Button>
              ) : (
                <Button variant="primary" onClick={() => navigate('/company', { replace: true })}>Go to dashboard</Button>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
