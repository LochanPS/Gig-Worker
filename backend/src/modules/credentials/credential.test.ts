// Pure credential helpers (no DB): status derivation + the PII-safe mapper.
import { describe, it, expect } from 'vitest';
import { credentialStatus, publicCredential } from './credential.service.js';

describe('credentialStatus', () => {
  const now = new Date('2026-09-03T00:00:00Z');
  it('is ACTIVE before expiry when not revoked', () => {
    expect(credentialStatus(new Date('2027-09-03T00:00:00Z'), false, now)).toBe('ACTIVE');
  });
  it('is EXPIRED once the expiry has passed', () => {
    expect(credentialStatus(new Date('2026-01-01T00:00:00Z'), false, now)).toBe('EXPIRED');
  });
  it('is REVOKED regardless of expiry when revoked', () => {
    expect(credentialStatus(new Date('2027-09-03T00:00:00Z'), true, now)).toBe('REVOKED');
  });
});

describe('publicCredential', () => {
  it('maps to the PII-safe wire shape and never leaks the encrypted credential JSON', () => {
    const row = {
      id: 'cred-1',
      userId: 'user-1',
      did: 'did:gigbridge:priya',
      credentialJs: 'ENCRYPTED_DEMO', // must not appear in output
      hash: '0xabc',
      issuedAt: new Date('2026-09-03T00:00:00Z'),
      expiresAt: new Date('2027-09-03T00:00:00Z'),
      revoked: false,
      anchorTxHash: '0xdef',
    };
    const pub = publicCredential(row);
    expect(pub).toEqual({
      id: 'cred-1',
      userId: 'user-1',
      did: 'did:gigbridge:priya',
      hash: '0xabc',
      issuedAt: '2026-09-03T00:00:00.000Z',
      expiresAt: '2027-09-03T00:00:00.000Z',
      revoked: false,
      anchorTxHash: '0xdef',
    });
    expect(JSON.stringify(pub)).not.toContain('ENCRYPTED_DEMO');
    expect('credentialJs' in pub).toBe(false);
  });
});
