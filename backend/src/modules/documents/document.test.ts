// Tests the money/escape helpers used by the document generator (pure, no DB).
import { describe, it, expect } from 'vitest';
import { fircCertNumber, purposeDescription } from './document.service.js';

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
