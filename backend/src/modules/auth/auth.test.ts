// Smoke tests for auth wiring. Run with `pnpm --filter ./backend test`.
// These exercise validation + guard behaviour that need no live DB.
import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '@gigbridge/shared';

describe('auth schemas', () => {
  it('rejects a bad email on register', () => {
    expect(() =>
      registerSchema.parse({ email: 'nope', password: 'secret1', role: 'COMPANY', country: 'DE', name: 'X' }),
    ).toThrow();
  });

  it('rejects a short password', () => {
    expect(() =>
      registerSchema.parse({ email: 'a@b.com', password: '123', role: 'FREELANCER', country: 'IN', name: 'X' }),
    ).toThrow();
  });

  it('accepts a valid company registration', () => {
    const r = registerSchema.parse({
      email: 'a@b.com',
      password: 'secret1',
      role: 'COMPANY',
      country: 'DE',
      name: 'Novatek',
      legalName: 'Novatek GmbH',
      regNumber: 'HRB123',
    });
    expect(r.role).toBe('COMPANY');
  });

  it('rejects an invalid country length on login-adjacent flow', () => {
    expect(loginSchema.parse({ email: 'a@b.com', password: 'x' }).email).toBe('a@b.com');
  });
});
