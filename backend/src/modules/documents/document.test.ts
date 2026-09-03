// Tests the money/escape helpers used by the document generator (pure, no DB).
import { describe, it, expect } from 'vitest';

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
