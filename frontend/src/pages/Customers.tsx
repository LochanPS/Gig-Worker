// Customers — create and manage the real parties (companies + freelancers).
// Admin sees everyone and can create either; a company sees its payable
// freelancers and can add new ones. Created + verified freelancers show up
// immediately in the New-payout picker (same directory).
import { useEffect, useState } from 'react';
import type { CustomerSummary } from '@gigbridge/shared';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { Chip } from '../components/bits.js';

type PartyRole = 'COMPANY' | 'FREELANCER';

export default function Customers() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [list, setList] = useState<CustomerSummary[]>([]);
  const [role, setRole] = useState<PartyRole>('FREELANCER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('IN');
  const [pan, setPan] = useState('');
  const [verified, setVerified] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.customers().then(setList).catch((e) => setErr((e as Error).message));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setErr(''); setMsg(''); setBusy(true);
    try {
      const c = await api.createCustomer({ role, name, email, country, verified, panOrTaxId: pan || undefined, legalName: role === 'COMPANY' ? name : undefined });
      setMsg(`Created ${c.name} (${c.role.toLowerCase()})${c.verified ? ' — verified, ready to transact' : ''}.`);
      setName(''); setEmail(''); setPan('');
      await load();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const verify = async (id: string) => {
    setErr('');
    try { await api.verifyCustomer(id); await load(); }
    catch (e) { setErr((e as Error).message); }
  };

  return (
    <>
      <h1 className="page">Customers</h1>
      <p className="sub">{isAdmin ? 'Every company and freelancer on the platform.' : 'Freelancers you can pay — add a new one and they appear in New payout.'}</p>

      <div className="card" style={{ marginBottom: 18, maxWidth: 720 }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          {isAdmin && (
            <div style={{ flex: 1, minWidth: 130 }}>
              <label>Type</label>
              <select value={role} onChange={(e) => setRole(e.target.value as PartyRole)}>
                <option value="FREELANCER">Freelancer</option>
                <option value="COMPANY">Company</option>
              </select>
            </div>
          )}
          <div style={{ flex: 2, minWidth: 160 }}><label>{role === 'COMPANY' ? 'Company name' : 'Full name'}</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div style={{ flex: 2, minWidth: 180 }}><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></div>
          <div style={{ flex: 1, minWidth: 80 }}><label>Country</label><input value={country} maxLength={2} onChange={(e) => setCountry(e.target.value.toUpperCase())} /></div>
        </div>
        <div className="row" style={{ alignItems: 'flex-end', marginTop: 10 }}>
          {role === 'FREELANCER' && <div style={{ flex: 2, minWidth: 160 }}><label>PAN / Tax ID (optional)</label><input value={pan} onChange={(e) => setPan(e.target.value)} /></div>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, flex: 1 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={verified} onChange={(e) => setVerified(e.target.checked)} />
            Verify now (provision wallet + credential)
          </label>
          <button className="btn" onClick={create} disabled={busy || !name || !email}>{busy ? 'Creating…' : 'Add customer'}</button>
        </div>
        {msg && <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>{msg}</div>}
        {err && <div className="err">{err}</div>}
      </div>

      <table className="table" style={{ width: '100%', fontSize: 13.5 }}>
        <thead><tr>
          <th style={{ textAlign: 'left' }}>Name</th><th style={{ textAlign: 'left' }}>Email</th><th>Type</th><th>Country</th><th>Payments</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          {list.map((c) => (
            <tr key={c.id}>
              <td><b>{c.name}</b></td>
              <td className="mono" style={{ fontSize: 12 }}>{c.email}</td>
              <td style={{ textAlign: 'center' }}>{c.role}</td>
              <td style={{ textAlign: 'center' }}>{c.country}</td>
              <td style={{ textAlign: 'center' }}>{c.paymentsCount ?? 0}</td>
              <td style={{ textAlign: 'center' }}><Chip value={c.status} /></td>
              <td>{!c.verified && isAdmin && c.role !== 'ADMIN' && <button className="btn ghost" onClick={() => verify(c.id)}>Verify</button>}</td>
            </tr>
          ))}
          {list.length === 0 && <tr><td colSpan={7} className="muted">No customers yet — add one above.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
