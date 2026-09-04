import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Payment } from '@gigbridge/shared';
import { useAsync } from '@/lib/useAsync';
import { gateway } from '@/lib/gateway';
import { FREELANCERS, type DirectoryFreelancer } from '@/lib/directory';
import { formatMoney } from '@/lib/money';
import { formatDate, countryName } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { Panel, Button, Field, Input, Textarea } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/modal';
import { VerifiedChip } from '@/components/StatusChip';
import { DataTable, type Column } from '@/components/DataTable';
import { useToast } from '@/components/ui/toast';

interface RosterRow extends DirectoryFreelancer {
  totalPaidMinor: number;
  totalCurrency: string;
  lastPaymentAt: string | null;
}

export function CompanyFreelancers() {
  const navigate = useNavigate();
  const { push } = useToast();
  const state = useAsync<Payment[]>(() => gateway.listPayments(), []);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const rows = useMemo<RosterRow[]>(() => {
    const payments = state.data ?? [];
    return FREELANCERS.map((f) => {
      const theirs = payments.filter((p) => p.freelancerId === f.id && p.state === 'COMPLETED');
      const totalPaidMinor = theirs.reduce((s, p) => s + p.srcAmountMinor, 0);
      const last = theirs.map((p) => p.createdAt).sort().at(-1) ?? null;
      return {
        ...f,
        totalPaidMinor,
        totalCurrency: theirs[0]?.srcCurrency ?? 'EUR',
        lastPaymentAt: last,
      };
    });
  }, [state.data]);

  const columns: Column<RosterRow>[] = [
    { key: 'name', header: 'Name', render: (r) => <span className="text-text">{r.name}</span> },
    { key: 'country', header: 'Country', render: (r) => <span className="text-muted text-[13px]">{countryName(r.country)}</span> },
    { key: 'cred', header: 'Credential', render: (r) => <VerifiedChip status={r.kycStatus} /> },
    {
      key: 'expiry',
      header: 'Expiry',
      render: (r) => <span className="num text-[12px] text-muted">{r.kycStatus === 'VERIFIED' ? formatDate(new Date(Date.now() + 300 * 86_400_000).toISOString()) : '-'}</span>,
    },
    { key: 'total', header: 'Total paid', align: 'right', render: (r) => <span className="num text-[13px]">{formatMoney(r.totalPaidMinor, r.totalCurrency)}</span> },
    { key: 'last', header: 'Last payment', align: 'right', render: (r) => <span className="num text-[12px] text-muted">{r.lastPaymentAt ? formatDate(r.lastPaymentAt) : 'Never'}</span> },
    {
      key: 'pay',
      header: '',
      align: 'right',
      width: '72px',
      render: (r) => (
        <Button
          size="sm"
          variant="default"
          onClick={(e) => {
            e.stopPropagation();
            navigate('/company/pay', { state: { payeeId: r.id, startStep: 2 } });
          }}
        >
          Pay
        </Button>
      ),
    },
  ];

  function sendInvite() {
    push(`Invitation sent to ${email}`);
    setInviteOpen(false);
    setEmail('');
    setMessage('');
  }

  return (
    <>
      <PageHeader
        title="Freelancers"
        action={<Button variant="primary" onClick={() => setInviteOpen(true)}>Invite freelancer</Button>}
      />
      <Panel>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
      </Panel>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite a freelancer"
        footer={
          <>
            <Button variant="quiet" size="sm" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={!email.includes('@')} onClick={sendInvite}>Send invite</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Email" htmlFor="invite-email">
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </Field>
          <Field label="Message" hint="Optional. Included in the invitation email." htmlFor="invite-msg">
            <Textarea id="invite-msg" value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
