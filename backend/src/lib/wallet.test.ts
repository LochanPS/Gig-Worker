// The wallet resolver decides which account real value moves to, so its rules are
// pinned here: a stored address is always the address of the stored key, an
// operator's account is used as given, and a contradictory pair is refused rather
// than one half silently winning.
import { describe, it, expect } from 'vitest';
import { resolveWallet, addressOfKey, walletSourceOf } from './wallet.js';

// anvil account 0 — a publicly known test key, never holds real funds.
const KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

describe('resolveWallet', () => {
  it('derives the address from a supplied key, so the two always agree', () => {
    const w = resolveWallet({ walletKey: KEY });
    expect(w.address).toBe(ADDR);
    expect(w.key).toBe(KEY);
    expect(w.source).toBe('PROVIDED');
  });

  it('accepts a matching address/key pair regardless of case', () => {
    const w = resolveWallet({ walletAddress: ADDR.toLowerCase(), walletKey: KEY });
    expect(w.address).toBe(ADDR);
    expect(w.key).toBe(KEY);
  });

  it('refuses a pair that disagrees instead of picking one', () => {
    expect(() => resolveWallet({ walletAddress: '0x' + '1'.repeat(40), walletKey: KEY })).toThrow(/belongs to/);
  });

  it('takes an address alone as receive-only — no key is invented beside it', () => {
    const w = resolveWallet({ walletAddress: ADDR });
    expect(w.address).toBe(ADDR);
    expect(w.key).toBeNull(); // the mismatch bug this module exists to prevent
    expect(w.source).toBe('PROVIDED');
  });

  it('generates a matched pair when nothing is supplied', () => {
    const w = resolveWallet({});
    expect(w.source).toBe('GENERATED');
    expect(w.key).toBeTruthy();
    expect(w.address).toBe(addressOfKey(w.key!)); // the invariant
  });

  it('generates a different wallet each time', () => {
    expect(resolveWallet({}).address).not.toBe(resolveWallet({}).address);
  });

  it('rejects malformed input', () => {
    expect(() => resolveWallet({ walletKey: '0xdeadbeef' })).toThrow(/64 hex/);
    expect(() => resolveWallet({ walletAddress: 'not-an-address' })).toThrow(/40 hex/);
  });
});

describe('walletSourceOf', () => {
  it('reports stored provenance, defaulting pre-column rows to generated', () => {
    expect(walletSourceOf(ADDR, 'PROVIDED')).toBe('PROVIDED');
    expect(walletSourceOf(ADDR, 'GENERATED')).toBe('GENERATED');
    expect(walletSourceOf(ADDR, null)).toBe('GENERATED'); // legacy row
  });

  it('has no source when there is no wallet at all', () => {
    expect(walletSourceOf(null, null)).toBeNull();
  });
});
