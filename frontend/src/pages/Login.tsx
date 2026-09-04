import { useState } from 'react';
import type { Role } from '@gigbridge/shared';
import { useAuth } from '../lib/auth.js';

const DEMO = [
  ['novatek@demo.gg', 'Company · Novatek GmbH'],
  ['priya@demo.gg', 'Freelancer · Priya Sharma'],
  ['admin@demo.gg', 'Admin · Operator'],
];

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('novatek@demo.gg');
  const [password, setPassword] = useState('demo1234');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('FREELANCER');
  const [country, setCountry] = useState('IN');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register({ email, password, role, country, name: name || email.split('@')[0] });
    } catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };

  const signup = mode === 'signup';

  return (
    <div className="login">
      <form className="box card" onSubmit={submit}>
        <div className="brand"><span className="dot" />GigBridge</div>
        <p className="sub">Cross-border freelancer payments</p>

        <div className="row" style={{ gap: 8, marginBottom: 14 }}>
          <button type="button" className={`btn ${signup ? 'ghost' : ''}`} style={{ flex: 1 }} onClick={() => setMode('login')}>Sign in</button>
          <button type="button" className={`btn ${signup ? '' : 'ghost'}`} style={{ flex: 1 }} onClick={() => setMode('signup')}>Create account</button>
        </div>

        {signup && (
          <>
            <label>I am a</label>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className={`btn ${role === 'FREELANCER' ? '' : 'ghost'}`} style={{ flex: 1 }} onClick={() => setRole('FREELANCER')}>Freelancer</button>
              <button type="button" className={`btn ${role === 'COMPANY' ? '' : 'ghost'}`} style={{ flex: 1 }} onClick={() => setRole('COMPANY')}>Company</button>
            </div>
            <div style={{ height: 12 }} />
            <label>{role === 'COMPANY' ? 'Company name' : 'Full name'}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
            <div style={{ height: 12 }} />
            <label>Country (ISO-2)</label>
            <input value={country} maxLength={2} onChange={(e) => setCountry(e.target.value.toUpperCase())} />
            <div style={{ height: 12 }} />
          </>
        )}

        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <div style={{ height: 12 }} />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={signup ? 'new-password' : 'current-password'} />
        <div style={{ height: 16 }} />
        <button className="btn" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
        </button>
        {err && <div className="err">{err}</div>}

        {signup && <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>After signup, open <b>Verify</b> to complete KYC/KYB before transacting.</div>}

        {!signup && (
          <div style={{ marginTop: 16 }} className="muted">
            <div style={{ fontSize: 12, marginBottom: 6 }}>Demo accounts (password demo1234):</div>
            {DEMO.map(([e, label]) => (
              <div key={e} className="mono" style={{ fontSize: 12, cursor: 'pointer' }} onClick={() => setEmail(e)}>· {e} — {label}</div>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}
