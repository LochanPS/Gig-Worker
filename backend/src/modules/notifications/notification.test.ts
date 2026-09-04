// Notification mapping (no DB).
import { describe, it, expect } from 'vitest';
import { publicNotification } from './notification.service.js';

const row = {
  id: 'n1',
  userId: '33333333-3333-3333-3333-333333333333',
  kind: 'KYC_VERIFIED',
  message: 'Identity verified — add a payout account to receive payments.',
  read: false,
  createdAt: new Date('2026-09-04T10:00:00.000Z'),
};

describe('publicNotification', () => {
  it('serialises createdAt as an ISO string for the wire', () => {
    expect(publicNotification(row).createdAt).toBe('2026-09-04T10:00:00.000Z');
  });

  it('carries kind, message and read through unchanged', () => {
    const n = publicNotification(row);
    expect(n.kind).toBe('KYC_VERIFIED');
    expect(n.message).toContain('Identity verified');
    expect(n.read).toBe(false);
  });

  it('keeps the owning user so the client can assert scoping', () => {
    expect(publicNotification(row).userId).toBe(row.userId);
  });

  it('reflects a read notification', () => {
    expect(publicNotification({ ...row, read: true }).read).toBe(true);
  });
});
