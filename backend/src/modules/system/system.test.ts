// The settlement badge is a correctness claim about money: it must never tell an
// operator their payments went on-chain when the backend quietly fell back.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSystemInfo, recordSettlement } from './system.service.js';

const CONTRACTS = { EscrowVault: '0xabc', MockUSDC: '0xdef', IdentityRegistry: '0x111', AuditAnchor: '0x222' };

describe('system info', () => {
  const original = process.env.CHAIN_ID;
  beforeEach(() => recordSettlement({ active: 'simulated', degraded: false, contracts: null }));
  afterEach(() => { process.env.CHAIN_ID = original; });

  it('defaults to simulated, undegraded', () => {
    const info = getSystemInfo();
    expect(info.settlementMode).toBe('simulated');
    expect(info.degraded).toBe(false);
  });

  it('reports real settlement with the deployed contract addresses', () => {
    recordSettlement({ active: 'real', degraded: false, contracts: CONTRACTS });
    const info = getSystemInfo();
    expect(info.settlementMode).toBe('real');
    expect(info.contracts?.EscrowVault).toBe('0xabc');
  });

  it('marks a fallback to simulated as degraded, not as a plain simulation', () => {
    recordSettlement({ active: 'simulated', degraded: true, contracts: null });
    const info = getSystemInfo();
    expect(info.settlementMode).toBe('simulated');
    expect(info.degraded).toBe(true); // "you asked for real and did not get it"
  });

  it('never reports contracts while simulating', () => {
    recordSettlement({ active: 'simulated', degraded: true, contracts: CONTRACTS });
    expect(getSystemInfo().contracts).toBeNull();
  });

  it('names the chain and its explorer', () => {
    process.env.CHAIN_ID = '84532';
    const info = getSystemInfo();
    expect(info.chainName).toBe('Base Sepolia');
    expect(info.explorerUrl).toBe('https://sepolia.basescan.org');
  });

  it('has no explorer for a local dev chain', () => {
    process.env.CHAIN_ID = '31337';
    expect(getSystemInfo().explorerUrl).toBeNull();
  });

  it('degrades gracefully on an unknown chain id', () => {
    process.env.CHAIN_ID = '999999';
    const info = getSystemInfo();
    expect(info.chainName).toBe('Chain 999999');
    expect(info.explorerUrl).toBeNull();
  });
});
