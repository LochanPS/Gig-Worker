// Payout rail (USDC->INR off-ramp) tests — pure, deterministic, network-free.
import { describe, it, expect } from 'vitest';
import {
  buildUpiIntent,
  destinationFromAccount,
  simulatedPayoutRail,
  getPayoutRail,
  setPayoutRail,
  type PayoutInstruction,
  type PayoutRail,
} from './payout-rail.interface.js';

const upiInstruction = (over: Partial<PayoutInstruction> = {}): PayoutInstruction => ({
  paymentId: 'pay-1',
  amountMinorInr: 4500000, // ₹45,000.00 in paise
  destination: { method: 'UPI', accountName: 'Asha Rao', vpa: 'asha@okhdfcbank', accountNumberMasked: null, bankIdentifier: null },
  purposeCode: 'P0802',
  reference: 'pay-1',
  ...over,
});

describe('buildUpiIntent', () => {
  it('scales paise to rupees with two decimals and encodes the VPA + amount', () => {
    const intent = buildUpiIntent('asha@okhdfcbank', 'Asha Rao', 1234599, 'pay-9');
    expect(intent.startsWith('upi://pay?')).toBe(true);
    const q = new URLSearchParams(intent.split('?')[1]);
    expect(q.get('pa')).toBe('asha@okhdfcbank');
    expect(q.get('am')).toBe('12345.99'); // 1,234,599 paise -> ₹12,345.99
    expect(q.get('cu')).toBe('INR');
    expect(q.get('pn')).toBe('Asha Rao');
    expect(q.get('tn')).toContain('pay-9');
  });

  it('falls back to a placeholder payee name when empty', () => {
    const q = new URLSearchParams(buildUpiIntent('x@y', '', 100, 'r').split('?')[1]);
    expect(q.get('pn')).toBe('Payee');
    expect(q.get('am')).toBe('1.00');
  });
});

describe('simulatedPayoutRail.execute', () => {
  it('credits a UPI destination instantly and returns a scannable upi:// intent', async () => {
    const r = await simulatedPayoutRail.execute(upiInstruction());
    expect(r.status).toBe('CREDITED');
    expect(r.railRef.startsWith('UPI-')).toBe(true);
    expect(r.upiIntent).toContain('asha@okhdfcbank');
    expect(r.upiIntent).toContain('am=45000.00');
  });

  it('credits a bank destination with a NEFT-style ref and no UPI intent', async () => {
    const r = await simulatedPayoutRail.execute(
      upiInstruction({
        destination: { method: 'BANK', accountName: 'Asha Rao', vpa: null, accountNumberMasked: '••••1234', bankIdentifier: 'HDFC0001234' },
      }),
    );
    expect(r.status).toBe('CREDITED');
    expect(r.railRef.startsWith('NEFT-')).toBe(true);
    expect(r.upiIntent).toBeNull();
  });
});

describe('destinationFromAccount', () => {
  it('maps a UPI account to a UPI destination carrying the VPA', () => {
    const d = destinationFromAccount({
      method: 'UPI', accountName: 'Asha Rao', vpa: 'asha@okhdfcbank', accountNumberMasked: null, bankIdentifier: null,
    });
    expect(d.method).toBe('UPI');
    expect(d.vpa).toBe('asha@okhdfcbank');
  });

  it('maps a bank account to a BANK destination and defaults an unknown/absent method to BANK', () => {
    const bank = destinationFromAccount({
      method: 'BANK', accountName: 'Asha Rao', vpa: null, accountNumberMasked: '••••1234', bankIdentifier: 'HDFC0001234',
    });
    expect(bank.method).toBe('BANK');
    expect(bank.accountNumberMasked).toBe('••••1234');
    // legacy rows written before the method column existed
    expect(destinationFromAccount({ method: null, accountName: 'X', vpa: null, accountNumberMasked: '••••9', bankIdentifier: 'IFSC' }).method).toBe('BANK');
  });
});

describe('getPayoutRail / setPayoutRail', () => {
  it('defaults to the simulated rail and can be swapped (e.g. a real PA-CB rail)', async () => {
    expect(getPayoutRail()).toBe(simulatedPayoutRail);
    const stub: PayoutRail = {
      async execute() {
        return { railRef: 'STUB-1', status: 'SENT', upiIntent: null };
      },
      async status() {
        return 'SENT';
      },
    };
    try {
      setPayoutRail(stub);
      expect(getPayoutRail()).toBe(stub);
      expect((await getPayoutRail().execute(upiInstruction())).railRef).toBe('STUB-1');
    } finally {
      setPayoutRail(simulatedPayoutRail); // restore for other tests
    }
  });
});
