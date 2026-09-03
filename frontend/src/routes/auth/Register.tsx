import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button, Field, Input, Select } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

const COUNTRIES = ['DE', 'IN', 'US', 'GB', 'FR', 'NL', 'SG', 'AE'];

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<'COMPANY' | 'FREELANCER' | null>(null);
  const [form, setForm] = useState({
    name: '', email: '', password: '', country: 'IN',
    legalName: '', regNumber: '', panOrTaxId: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!role) return;
    setError(null);
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        role, name: form.name, email: form.email, password: form.password, country: form.country,
      };
      if (role === 'COMPANY') {
        payload.legalName = form.legalName || form.name;
        payload.regNumber = form.regNumber || 'PENDING';
      } else if (form.panOrTaxId) {
        payload.panOrTaxId = form.panOrTaxId;
      }
      await register(payload);
      navigate(role === 'COMPANY' ? '/onboarding/company' : '/onboarding/freelancer', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[520px]">
        <div className="text-[16px] font-medium tracking-[0.02em] mb-1">GigBridge</div>
        <h1 className="text-[26px] font-medium mb-7">Create an account</h1>

        <div className="grid grid-cols-2 gap-3 mb-7">
          {(['COMPANY', 'FREELANCER'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={cn(
                'border p-4 text-left transition-colors duration-150',
                role === r ? 'border-accent text-text' : 'border-line text-muted hover:border-line-strong',
              )}
            >
              <div className="text-[14px] mb-1">{r === 'COMPANY' ? 'Company' : 'Freelancer'}</div>
              <div className="text-[12px] text-faint leading-[1.5]">
                {r === 'COMPANY' ? 'Pay contractors across borders' : 'Get paid from anywhere'}
              </div>
            </button>
          ))}
        </div>

        {role ? (
          <form onSubmit={submit} className="flex flex-col gap-5">
            <Field label={role === 'COMPANY' ? 'Contact name' : 'Full name'} htmlFor="name">
              <Input id="name" value={form.name} onChange={set('name')} required />
            </Field>
            <Field label="Email" htmlFor="remail">
              <Input id="remail" type="email" value={form.email} onChange={set('email')} required />
            </Field>
            <Field label="Password" hint="At least 6 characters." htmlFor="rpassword">
              <Input id="rpassword" type="password" minLength={6} value={form.password} onChange={set('password')} required />
            </Field>
            <Field label="Country" htmlFor="country">
              <Select id="country" value={form.country} onChange={set('country')}>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>

            {role === 'COMPANY' ? (
              <>
                <Field label="Legal name" htmlFor="legalName">
                  <Input id="legalName" value={form.legalName} onChange={set('legalName')} />
                </Field>
                <Field label="Registration number" htmlFor="regNumber">
                  <Input id="regNumber" value={form.regNumber} onChange={set('regNumber')} />
                </Field>
              </>
            ) : (
              <Field label="Tax identifier" hint="PAN for India. Optional at signup." htmlFor="pan">
                <Input id="pan" value={form.panOrTaxId} onChange={set('panOrTaxId')} />
              </Field>
            )}

            {error ? <p role="alert" className="text-[12px] text-danger">{error}</p> : null}

            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Creating account' : 'Create account'}
            </Button>
          </form>
        ) : (
          <p className="text-[13px] text-muted">Choose how you will use GigBridge to continue.</p>
        )}

        <p className="mt-8 text-[12px] text-muted">
          Already registered? <Link to="/login" className="text-text underline underline-offset-2 decoration-line">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
