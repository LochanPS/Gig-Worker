// Authorization guards for the payment module (no DB).
//
// Before this, getPayment() took a requesterId and ignored it, and confirm /
// retry / release / refund never checked ownership — so any signed-in user could
// read, move or reverse anyone else's money. These cover the guards that closed it.
import { describe, it, expect } from 'vitest';
import { assertParty, assertPayer, type Actor } from './payment.service.js';

const PAYER = '11111111-1111-1111-1111-111111111111';
const PAYEE = '33333333-3333-3333-3333-333333333333';
const OUTSIDER = '22222222-2222-2222-2222-222222222222';
const ADMIN = '99999999-9999-9999-9999-999999999999';

const payment = { companyId: PAYER, freelancerId: PAYEE };
const as = (id: string, role: Actor['role']): Actor => ({ id, role });

describe('assertParty (read access)', () => {
  it('lets the paying company read its own payment', () => {
    expect(() => assertParty(payment, as(PAYER, 'COMPANY'))).not.toThrow();
  });

  it('lets the payee read the payment they are being paid on', () => {
    expect(() => assertParty(payment, as(PAYEE, 'FREELANCER'))).not.toThrow();
  });

  it('lets an admin read any payment', () => {
    expect(() => assertParty(payment, as(ADMIN, 'ADMIN'))).not.toThrow();
  });

  it('refuses another company', () => {
    expect(() => assertParty(payment, as(OUTSIDER, 'COMPANY'))).toThrow(/Not a party/);
  });

  it('refuses an unrelated freelancer', () => {
    expect(() => assertParty(payment, as(OUTSIDER, 'FREELANCER'))).toThrow(/Not a party/);
  });

  it('refuses with a 403, not a 500', () => {
    try {
      assertParty(payment, as(OUTSIDER, 'COMPANY'));
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as { statusCode?: number }).statusCode).toBe(403);
    }
  });
});

describe('assertPayer (write access)', () => {
  it('lets the paying company confirm/release/refund', () => {
    expect(() => assertPayer(payment, as(PAYER, 'COMPANY'))).not.toThrow();
  });

  it('lets an admin act on any payment', () => {
    expect(() => assertPayer(payment, as(ADMIN, 'ADMIN'))).not.toThrow();
  });

  it('refuses the payee — a party can read, but must not move the money', () => {
    expect(() => assertPayer(payment, as(PAYEE, 'FREELANCER'))).toThrow(/Only the paying company/);
  });

  it('refuses another company', () => {
    expect(() => assertPayer(payment, as(OUTSIDER, 'COMPANY'))).toThrow(/Only the paying company/);
  });
});
