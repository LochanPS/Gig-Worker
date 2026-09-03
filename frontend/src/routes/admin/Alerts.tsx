import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Alert, AlertType } from '@gigbridge/shared';
import { ALERT_TYPES } from '@gigbridge/shared';
import { gateway } from '@/lib/gateway';
import { formatMoney } from '@/lib/money';
import { formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { Panel, Button, Textarea } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { SeverityChip } from '@/components/StatusChip';
import { useToast } from '@/components/ui/toast';

const TYPE_LABEL: Record<AlertType, string> = {
  SANCTIONS: 'Sanctions',
  STRUCTURING: 'Structuring',
  VELOCITY: 'Velocity',
  OUTLIER: 'Outlier',
};

interface StructuringPayment {
  amountMinor: number;
  currency: string;
  at: string;
}

// Seeded alerts across every type so each group is demonstrable. Merged with
// whatever the server returns (deduped by id).
function seedAlerts(): Alert[] {
  const now = Date.now();
  return [
    {
      id: 'seed-str-1',
      type: 'STRUCTURING',
      severity: 'HIGH',
      paymentId: 'aaaaaaa1-0000-0000-0000-000000000001',
      details: {
        summary: 'Three payments just below the EUR 10,000 EDD threshold within 72 hours.',
        payments: [
          { amountMinor: 940000, currency: 'EUR', at: new Date(now - 1000 * 60 * 60 * 60).toISOString() },
          { amountMinor: 960000, currency: 'EUR', at: new Date(now - 1000 * 60 * 60 * 30).toISOString() },
          { amountMinor: 950000, currency: 'EUR', at: new Date(now - 1000 * 60 * 60 * 4).toISOString() },
        ] as StructuringPayment[],
      },
      resolved: false,
      createdAt: new Date(now - 1000 * 60 * 60 * 3).toISOString(),
    },
    {
      id: 'seed-vel-1',
      type: 'VELOCITY',
      severity: 'MEDIUM',
      paymentId: null,
      details: { summary: 'Payer sent 6 payments in 24 hours, above the platform velocity limit of 5.' },
      resolved: false,
      createdAt: new Date(now - 1000 * 60 * 90).toISOString(),
    },
    {
      id: 'seed-out-1',
      type: 'OUTLIER',
      severity: 'LOW',
      paymentId: null,
      details: { summary: 'A single payout was 6.2x the payer 30-day average.' },
      resolved: false,
      createdAt: new Date(now - 1000 * 60 * 220).toISOString(),
    },
    {
      id: 'seed-sanc-1',
      type: 'SANCTIONS',
      severity: 'HIGH',
      paymentId: null,
      details: { summary: 'A name partially matched an OFAC SDN entry. Cleared on manual review of date of birth.' },
      resolved: true,
      createdAt: new Date(now - 1000 * 60 * 400).toISOString(),
    },
  ];
}

export function AdminAlerts() {
  const navigate = useNavigate();
  const { push } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [resolving, setResolving] = useState<Alert | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    gateway
      .adminAlerts()
      .then((server) => {
        if (cancelled) return;
        const seed = seedAlerts();
        const ids = new Set(server.map((a) => a.id));
        setAlerts([...server, ...seed.filter((a) => !ids.has(a.id))]);
      })
      .catch(() => !cancelled && setAlerts(seedAlerts()));
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const g: Record<AlertType, Alert[]> = { SANCTIONS: [], STRUCTURING: [], VELOCITY: [], OUTLIER: [] };
    for (const a of alerts) g[a.type]?.push(a);
    return g;
  }, [alerts]);

  function doResolve() {
    if (!resolving) return;
    setAlerts((prev) => prev.map((a) => (a.id === resolving.id ? { ...a, resolved: true } : a)));
    push('Alert resolved');
    setResolving(null);
    setNote('');
  }

  return (
    <>
      <PageHeader title="Alerts" />
      <div className="flex flex-col gap-8">
        {ALERT_TYPES.map((type) => {
          const items = grouped[type];
          if (!items.length) return null;
          return (
            <section key={type}>
              <h2 className="text-[13px] font-medium mb-3 flex items-center gap-2">
                {TYPE_LABEL[type]}
                <span className="num text-[11px] text-faint">{items.length}</span>
              </h2>
              <div className="grid gap-3">
                {items.map((a) => (
                  <Panel key={a.id} className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <SeverityChip severity={a.severity} />
                        {a.resolved ? <span className="text-[11px] uppercase tracking-[0.06em] text-ok">Resolved</span> : null}
                      </div>
                      <span className="num text-[11px] text-faint">{formatDateTime(a.createdAt)}</span>
                    </div>
                    <p className="text-[13px] text-text leading-[1.5]">
                      {typeof a.details.summary === 'string' ? a.details.summary : typeof a.details.pattern === 'string' ? a.details.pattern : 'Pattern detected.'}
                    </p>

                    {Array.isArray(a.details.payments) ? (
                      <ul className="mt-3 border border-line divide-y divide-line">
                        {(a.details.payments as StructuringPayment[]).map((p, i) => (
                          <li key={i} className="flex items-center justify-between px-3 h-9">
                            <span className="num text-[12px] text-text">{formatMoney(p.amountMinor, p.currency)}</span>
                            <span className="num text-[11px] text-faint">{formatDateTime(p.at)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <div className="mt-3 flex items-center gap-2">
                      {a.paymentId ? (
                        <Button size="sm" variant="quiet" onClick={() => navigate(`/company/payments/${a.paymentId}`)}>View payment</Button>
                      ) : null}
                      {!a.resolved ? (
                        <Button size="sm" variant="default" className="ml-auto" onClick={() => setResolving(a)}>Resolve</Button>
                      ) : null}
                    </div>
                  </Panel>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <Modal
        open={resolving !== null}
        onClose={() => setResolving(null)}
        title="Resolve alert"
        footer={
          <>
            <Button variant="quiet" size="sm" onClick={() => setResolving(null)}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={note.trim().length < 4} onClick={doResolve}>Resolve</Button>
          </>
        }
      >
        <label htmlFor="anote" className="label mb-2 block">Resolution note</label>
        <Textarea id="anote" value={note} onChange={(e) => setNote(e.target.value)} placeholder="How was this alert dispositioned" />
      </Modal>
    </>
  );
}
