import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, homeFor } from '@/lib/auth';
import { Button, Field, Input } from '@/components/ui/primitives';
import { CorridorChart } from '@/components/charts/gb/CorridorChart';
import { fxSeries } from '@/lib/demoSeries';

const DEMO = [
  { email: 'novatek@demo.gg', who: 'Novatek GmbH, company' },
  { email: 'priya@demo.gg', who: 'Priya Sharma, freelancer' },
  { email: 'admin@demo.gg', who: 'Platform admin' },
];

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(homeFor(user.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in. Check the email and password and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-12">
      <div className="lg:col-span-5 flex flex-col justify-center px-6 md:px-12 py-12 border-r border-line">
        <div className="max-w-[380px] w-full mx-auto">
          <div className="text-[16px] font-medium tracking-[0.02em] mb-2">GigBridge</div>
          <p className="text-[13px] text-muted leading-[1.6] mb-9 max-w-[46ch]">
            Cross-border payouts that clear compliance in both jurisdictions and settle in under a minute.
          </p>

          <form onSubmit={submit} className="flex flex-col gap-5">
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>

            {error ? (
              <p role="alert" className="text-[12px] text-danger leading-[1.5]">
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Signing in' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-line">
            <div className="label mb-3">Demo accounts</div>
            <ul className="flex flex-col gap-1.5">
              {DEMO.map((d) => (
                <li key={d.email}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(d.email);
                      setPassword('demo1234');
                      setError(null);
                    }}
                    className="w-full text-left flex items-baseline justify-between gap-3 py-1 text-muted hover:text-text transition-colors"
                  >
                    <span className="num text-[12px]">{d.email}</span>
                    <span className="text-[11px] text-faint">{d.who}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-faint mt-3">All demo accounts use the password demo1234.</p>
          </div>

          <p className="mt-8 text-[12px] text-muted">
            No account?{' '}
            <Link to="/register" className="text-text underline underline-offset-2 decoration-line">
              Create one
            </Link>
          </p>
        </div>
      </div>

      <div className="lg:col-span-7 hidden lg:flex flex-col justify-center px-12 py-12 bg-surface">
        <div className="label mb-1">EUR to INR, trailing 30 days</div>
        <p className="text-[12px] text-faint mb-6 max-w-[52ch]">
          The mid-market rate every quote is priced against. No spread is added on top of it.
        </p>
        <div className="border border-line bg-bg p-5">
          <CorridorChart data={fxSeries('EURINR', 30)} height={300} />
        </div>
      </div>
    </div>
  );
}
