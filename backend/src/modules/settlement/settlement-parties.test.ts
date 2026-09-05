// A funding transaction needs two accounts with different requirements, and
// getting that asymmetry wrong is only visible against a real chain — so it is
// pinned here. The payer must be able to sign; the payee only has to receive.
import { describe, it, expect } from 'vitest';
import { settlementParties } from './real-settlement.js';

// anvil accounts 0 and 1 — publicly known test keys, never hold real funds.
const PAYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const PAYER_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const PAYEE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const PAYEE_ADDR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const payer = { walletAddress: PAYER_ADDR, walletKey: PAYER_KEY };
const payee = { walletAddress: PAYEE_ADDR, walletKey: PAYEE_KEY };

describe('settlementParties', () => {
  it('resolves a normal pair', () => {
    const r = settlementParties(payer, payee);
    expect(r.payerKey).toBe(PAYER_KEY);
    expect(r.payee).toBe(PAYEE_ADDR);
  });

  it('pays a receive-only payee — an address with no key is the whole point', () => {
    const r = settlementParties(payer, { walletAddress: PAYEE_ADDR, walletKey: null });
    expect(r.payee).toBe(PAYEE_ADDR);
  });

  it('refuses a receive-only PAYER, with a message saying what to do', () => {
    expect(() => settlementParties({ walletAddress: PAYER_ADDR, walletKey: null }, payee))
      .toThrow(/cannot sign a funding transaction/);
    expect(() => settlementParties({ walletAddress: PAYER_ADDR, walletKey: null }, payee))
      .toThrow(/add the account's private key/i);
  });

  it('uses the stored address, not one re-derived from the payee key', () => {
    // A legacy row where the two disagree: the stored address wins, because it is
    // what the UI shows and what an operator was told the money goes to.
    const legacy = { walletAddress: '0x' + '1'.repeat(40), walletKey: PAYEE_KEY };
    expect(settlementParties(payer, legacy).payee).toBe('0x' + '1'.repeat(40));
  });

  it('falls back to the key-derived address for a row with no stored address', () => {
    expect(settlementParties(payer, { walletAddress: null, walletKey: PAYEE_KEY }).payee).toBe(PAYEE_ADDR);
  });

  it('refuses a payee with no wallet at all', () => {
    expect(() => settlementParties(payer, { walletAddress: null, walletKey: null }))
      .toThrow(/no settlement wallet/);
  });

  it('accepts the orchestrator address when it agrees, in any case', () => {
    expect(settlementParties(payer, payee, PAYEE_ADDR.toLowerCase()).payee).toBe(PAYEE_ADDR);
  });

  it('treats the legacy 0xpayee placeholder as "no opinion"', () => {
    expect(settlementParties(payer, payee, '0xpayee').payee).toBe(PAYEE_ADDR);
  });

  it('refuses to fund when the orchestrator and the payee account disagree', () => {
    expect(() => settlementParties(payer, payee, '0x' + '9'.repeat(40)))
      .toThrow(/payee wallet mismatch/);
  });
});
