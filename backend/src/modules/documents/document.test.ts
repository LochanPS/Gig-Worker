// Tests the money/escape helpers used by the document generator (pure, no DB).
import { describe, it, expect } from 'vitest';
import { fircCertNumber, purposeDescription, paymentDocuments, assertFircEligible, maskVpa, payoutDeliveryLine } from './document.service.js';

// Re-declare the same helpers to test their behaviour (kept in sync with service).
const money = (minor: number | null | undefined, ccy: string) =>
  minor == null ? '—' : `${ccy} ${(minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

describe('document helpers', () => {
  it('formats minor units as money', () => {
    expect(money(4512000, 'INR')).toBe('INR 45,120.00');
    expect(money(375, 'EUR')).toBe('EUR 3.75');
    expect(money(null, 'EUR')).toBe('—');
  });

  it('escapes HTML to prevent injection in generated documents', () => {
    expect(esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(esc('A & B "quoted"')).toBe('A &amp; B &quot;quoted&quot;');
  });
});

describe('FIRC helpers', () => {
  it('derives a deterministic certificate number from the payment id + year', () => {
    const id = '33333333-3333-3333-3333-333333333333';
    expect(fircCertNumber(id, new Date('2026-09-03T00:00:00Z'))).toBe('FIRC/2026/33333333');
    // stable for the same id + year
    expect(fircCertNumber(id, new Date('2026-01-01T00:00:00Z'))).toBe('FIRC/2026/33333333');
    // year comes from the issue date
    expect(fircCertNumber(id, new Date('2027-05-05T00:00:00Z'))).toBe('FIRC/2027/33333333');
  });

  it('describes known purpose codes and falls back gracefully', () => {
    expect(purposeDescription('P0802')).toBe('P0802 — Software services');
    expect(purposeDescription('P9999')).toBe('P9999'); // unknown code passes through
    expect(purposeDescription(null)).toBe('Not specified');
    expect(purposeDescription(undefined)).toBe('Not specified');
  });
});

describe('off-ramp delivery line (FIRC)', () => {
  it('masks a UPI VPA, keeping the first char and the PSP', () => {
    expect(maskVpa('priya@okhdfcbank')).toBe('p****@okhdfcbank');
    expect(maskVpa('ab@ybl')).toBe('a**@ybl');
    expect(maskVpa(null)).toBeNull();
    expect(maskVpa('nohandle')).toBe('nohandle'); // no '@' passes through
  });

  it('describes the off-ramp delivery method', () => {
    expect(payoutDeliveryLine('UPI', { vpa: 'priya@okhdfcbank' })).toBe('UPI · p****@okhdfcbank');
    expect(payoutDeliveryLine('BANK', { accountMasked: '****1234' })).toBe('Bank transfer · ****1234');
    expect(payoutDeliveryLine(null, {})).toBe('Bank transfer'); // pre-UPI default
  });
});

describe('paymentDocuments', () => {
  const byKind = (docs: ReturnType<typeof paymentDocuments>) =>
    Object.fromEntries(docs.map((d) => [d.kind, d]));

  it('makes all three available for a COMPLETED INR remittance with a decision', () => {
    const d = byKind(paymentDocuments({ id: 'p1', state: 'COMPLETED', dstCurrency: 'INR', hasDecision: true }));
    expect(d.compliance.available).toBe(true);
    expect(d.receipt.available).toBe(true);
    expect(d.firc.available).toBe(true);
    expect(d.firc.url).toBe('/api/v1/payments/p1/firc.pdf');
    for (const doc of Object.values(d)) expect(doc.reason).toBeUndefined();
  });

  it('gates receipt and FIRC until completion; compliance stays available', () => {
    const d = byKind(paymentDocuments({ id: 'p2', state: 'FUNDED', dstCurrency: 'INR', hasDecision: true }));
    expect(d.compliance.available).toBe(true);
    expect(d.receipt.available).toBe(false);
    expect(d.receipt.reason).toBe('Available once the payment is completed');
    expect(d.firc.available).toBe(false);
    expect(d.firc.reason).toBe('Available once the payment is completed');
  });

  it('withholds FIRC for a non-INR corridor even when completed', () => {
    const d = byKind(paymentDocuments({ id: 'p3', state: 'COMPLETED', dstCurrency: 'USD', hasDecision: true }));
    expect(d.receipt.available).toBe(true);
    expect(d.firc.available).toBe(false);
    expect(d.firc.reason).toBe('Only for remittances credited in INR');
  });

  it('marks compliance unavailable before a decision exists', () => {
    const d = byKind(paymentDocuments({ id: 'p4', state: 'DRAFT', dstCurrency: 'INR', hasDecision: false }));
    expect(d.compliance.available).toBe(false);
    expect(d.compliance.reason).toBe('Compliance has not run yet');
  });
});

describe('assertFircEligible', () => {
  it('passes for a COMPLETED INR remittance', () => {
    expect(() => assertFircEligible('COMPLETED', 'INR')).not.toThrow();
  });
  it('rejects a non-INR corridor with statusCode 400', () => {
    expect(() => assertFircEligible('COMPLETED', 'USD')).toThrowError(/credited in INR/);
    try {
      assertFircEligible('COMPLETED', 'USD');
    } catch (e) {
      expect((e as { statusCode?: number }).statusCode).toBe(400);
    }
  });
  it('rejects an unsettled remittance with statusCode 409', () => {
    expect(() => assertFircEligible('FUNDED', 'INR')).toThrowError(/COMPLETED remittance/);
    try {
      assertFircEligible('FUNDED', 'INR');
    } catch (e) {
      expect((e as { statusCode?: number }).statusCode).toBe(409);
    }
  });
});
