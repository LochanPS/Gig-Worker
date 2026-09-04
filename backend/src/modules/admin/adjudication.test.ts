// Adjudication metric derivation (no DB).
import { describe, it, expect } from 'vitest';
import { parseReviewNote, autoHandledPercent } from './adjudication.service.js';

describe('parseReviewNote', () => {
  it('pulls confidence and rationale out of the adjudicator format', () => {
    const r = parseReviewNote('[AUTO_CLEAR · 87% confidence] All rules cleared for this corridor.');
    expect(r.confidence).toBeCloseTo(0.87);
    expect(r.rationale).toBe('All rules cleared for this corridor.');
  });

  it('handles an escalation note', () => {
    const r = parseReviewNote('[ESCALATE · 40% confidence] Possible sanctions match.');
    expect(r.confidence).toBeCloseTo(0.4);
    expect(r.rationale).toContain('sanctions');
  });

  it('keeps a human note as the rationale with no confidence', () => {
    const r = parseReviewNote('EDD complete; invoice on file.');
    expect(r.confidence).toBeNull();
    expect(r.rationale).toBe('EDD complete; invoice on file.');
  });

  it('is null-safe for a decision nobody reviewed', () => {
    expect(parseReviewNote(null)).toEqual({ confidence: null, rationale: null });
  });
});

describe('autoHandledPercent', () => {
  it('is zero with nothing adjudicated rather than NaN', () => {
    expect(autoHandledPercent(0, 0, 0)).toBe(0);
  });

  it('counts cleared and rejected as handled, escalations as not', () => {
    expect(autoHandledPercent(7, 1, 2)).toBe(80);
  });

  it('is zero when everything escalates', () => {
    expect(autoHandledPercent(0, 0, 5)).toBe(0);
  });

  it('is 100 when the agent settles everything', () => {
    expect(autoHandledPercent(3, 1, 0)).toBe(100);
  });
});
