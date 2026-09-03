import { useState } from 'react';
import { useAuth } from '../lib/auth.js';

const DEMO = [
  ['novatek@demo.gg', 'Company · Novatek GmbH'],
  ['priya@demo.gg', 'Freelancer · Priya Sharma'],
  ['admin@demo.gg', 'Admin · Operator'],
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('novatek@demo.gg');
  const [password, setPassword] = useState('demo1234');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { await login(email, password); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="login">
      <form className="box card" onSubmit={submit}>
        <div className="brand"><span className="dot" />GigBridge</div>
        <p className="sub">Cross-border freelancer payments</p>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <div style={{ height: 12 }} />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <div style={{ height: 16 }} />
        <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {err && <div className="err">{err}</div>}
        <div style={{ marginTop: 16 }} className="muted" >
          <div style={{ fontSize: 12, marginBottom: 6 }}>Demo accounts (password demo1234):</div>
          {DEMO.map(([e, label]) => (
            <div key={e} className="mono" style={{ fontSize: 12, cursor: 'pointer' }} onClick={() => setEmail(e)}>· {e} — {label}</div>
          ))}
        </div>
      </form>
    </div>
  );
}
