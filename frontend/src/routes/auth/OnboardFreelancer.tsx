import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Credential } from '@gigbridge/shared';
import { useAuth } from '@/lib/auth';
import { Button, Field, Input, Select, Panel } from '@/components/ui/primitives';
import { CredentialCard } from '@/components/CredentialCard';
import { cn } from '@/lib/utils';

const STEPS = ['Profile', 'Tax identity', 'Documents', 'Verification'];
const COUNTRIES = ['IN', 'US', 'GB', 'DE', 'FR', 'NL', 'SG', 'AE'];
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

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

export function OnboardFreelancer() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [profession, setProfession] = useState('Software engineer');
  const [country, setCountry] = useState(user?.country ?? 'IN');
  const [pan, setPan] = useState('');
  const [panTouched, setPanTouched] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const panError = country === 'IN' && panTouched && !PAN_RE.test(pan) ? 'Enter a valid PAN, for example ABCDE1234F.' : null;
  const canLeaveTax = country !== 'IN' || PAN_RE.test(pan);

  useEffect(() => {
    if (step !== 3) return;
    setProgress(0);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / 2000, 1);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  const credential = useMemo<Credential>(() => {
    const slug = (user?.name ?? 'freelancer').toLowerCase().replace(/[^a-z]+/g, '-');
    return {
      id: 'cred-local',
      userId: user?.id ?? 'local',
      did: `did:gigbridge:${slug}`,
      hash: '0x' + Array.from({ length: 64 }, (_, i) => '9a3f7c1e'[i % 8]).join(''),
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
      revoked: false,
      anchorTxHash: '0x' + Array.from({ length: 64 }, (_, i) => 'a1b2c3d4'[i % 8]).join(''),
    };
  }, [user]);

  const verified = step === 3 && progress >= 1;

  return (
    <div className="min-h-[100dvh] px-6 py-12 flex justify-center">
      <div className="w-full max-w-[860px]">
        <div className="text-[16px] font-medium tracking-[0.02em] mb-1">GigBridge</div>
        <h1 className="text-[26px] font-medium mb-8">Freelancer onboarding</h1>
        <div className="grid md:grid-cols-[200px_1fr] gap-8">
          <ProgressRail current={step} />
          <Panel className="p-6 min-h-[360px] flex flex-col">
            {step === 0 ? (
              <div className="flex flex-col gap-5">
                <h2 className="text-[16px]">Your profile</h2>
                <Field label="Full name" htmlFor="fname">
                  <Input id="fname" defaultValue={user?.name ?? ''} />
                </Field>
                <Field label="Profession" htmlFor="prof">
                  <Input id="prof" value={profession} onChange={(e) => setProfession(e.target.value)} />
                </Field>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="flex flex-col gap-5">
                <h2 className="text-[16px]">Tax identity</h2>
                <Field label="Country of residence" htmlFor="country">
                  <Select id="country" value={country} onChange={(e) => setCountry(e.target.value)}>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
                {country === 'IN' ? (
                  <Field label="PAN" hint="Ten characters, five letters then four digits then a letter." error={panError} htmlFor="pan">
                    <Input
                      id="pan"
                      value={pan}
                      maxLength={10}
                      onChange={(e) => setPan(e.target.value.toUpperCase())}
                      onBlur={() => setPanTouched(true)}
                      placeholder="ABCDE1234F"
                      className="num"
                    />
                  </Field>
                ) : (
                  <Field label="Tax identifier" hint="Optional outside India." htmlFor="tax">
                    <Input id="tax" className="num" />
                  </Field>
                )}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="flex flex-col gap-5">
                <h2 className="text-[16px]">Verification documents</h2>
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) setFileName(f.name);
                  }}
                  className="border border-dashed border-line-strong bg-bg h-40 flex flex-col items-center justify-center gap-2 text-center px-6"
                >
                  <span className="text-[13px] text-muted">Drop a passport or ID scan here, or click to choose</span>
                  <span className="text-[12px] text-faint">PDF, PNG or JPG. This is a demo, nothing is uploaded.</span>
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                  />
                </label>
                {fileName ? (
                  <p className="text-[13px] text-ok">Attached <span className="num text-text">{fileName}</span></p>
                ) : null}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="flex flex-col gap-5">
                <h2 className="text-[16px]">{verified ? 'Credential issued' : 'Issuing your credential'}</h2>
                {!verified ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-[13px] text-muted">
                      The agent is checking your documents and anchoring a verifiable credential on-chain.
                    </p>
                    <div className="h-[3px] bg-line w-full">
                      <div className="h-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
                    </div>
                  </div>
                ) : (
                  <CredentialCard credential={credential} />
                )}
              </div>
            ) : null}

            <div className="mt-auto pt-6 flex items-center justify-between">
              {step > 0 && !verified ? (
                <Button variant="quiet" onClick={() => setStep((s) => s - 1)}>Back</Button>
              ) : (
                <span />
              )}
              {step < 3 ? (
                <Button
                  variant="primary"
                  disabled={step === 1 && !canLeaveTax}
                  onClick={() => {
                    if (step === 1) setPanTouched(true);
                    if (step === 1 && !canLeaveTax) return;
                    setStep((s) => s + 1);
                  }}
                >
                  Continue
                </Button>
              ) : (
                <Button variant="primary" disabled={!verified} onClick={() => navigate('/me', { replace: true })}>
                  Go to balance
                </Button>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
