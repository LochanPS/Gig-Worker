// A settlement wallet decides where money lands, so who may change one is pinned
// here rather than left to a service call nobody reads.
import { describe, it, expect } from 'vitest';
import { canUpdateWallet } from './customer.service.js';

const admin = { id: 'admin', role: 'ADMIN' as const };
const acme = { id: 'acme', role: 'COMPANY' as const };
const rival = { id: 'rival', role: 'COMPANY' as const };
const payee = { id: 'payee', role: 'FREELANCER' as const };
const other = { id: 'other', role: 'FREELANCER' as const };

describe('canUpdateWallet', () => {
  it('lets an admin repoint anyone', () => {
    expect(canUpdateWallet(admin, acme)).toBe(true);
    expect(canUpdateWallet(admin, payee)).toBe(true);
  });

  it('lets anyone set their own wallet', () => {
    expect(canUpdateWallet(acme, acme)).toBe(true);
    expect(canUpdateWallet(payee, payee)).toBe(true);
  });

  it('lets a company set a payee wallet, as it already does at creation', () => {
    expect(canUpdateWallet(acme, payee)).toBe(true);
  });

  it('stops a company repointing another company', () => {
    expect(canUpdateWallet(acme, rival)).toBe(false);
  });

  it('stops a freelancer repointing someone else', () => {
    expect(canUpdateWallet(payee, other)).toBe(false);
    expect(canUpdateWallet(payee, acme)).toBe(false);
  });
});
