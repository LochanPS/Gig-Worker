// AI dispute triage — heuristic path (no API key in test, so the deterministic
// floor runs). Verifies the safety rules: fraud/legal + high-value always escalate,
// clear non-delivery auto-refunds, delivered/withdrawn auto-dismisses, ambiguous
// escalates, and the confidence gate holds.
import { describe, it, expect } from 'vitest';
import { adjudicateDispute, resolveDisputeAction } from './dispute-adjudicator.js';

const facts = { payerName: 'Novatek', payeeName: 'Priya', amountUsdMinor: 54000 };

describe('AI dispute triage (heuristic)', () => {
  it('escalates a fraud / legal claim — never auto-resolves', async () => {
    const a = await adjudicateDispute({ reason: 'This looks like fraud, I am taking legal action', raisedByRole: 'COMPANY', facts });
    expect(a.action).toBe('ESCALATE');
    expect(resolveDisputeAction(a)).toBe('ESCALATE');
  });

  it('recommends AUTO_REFUND for clear non-delivery', async () => {
    const a = await adjudicateDispute({ reason: 'Work not delivered, I never received anything', raisedByRole: 'COMPANY', facts });
    expect(a.action).toBe('AUTO_REFUND');
    expect(resolveDisputeAction(a)).toBe('AUTO_REFUND');
  });

  it('recommends AUTO_DISMISS when the work was delivered / dispute withdrawn', async () => {
    const a = await adjudicateDispute({ reason: 'Opened by mistake — the work was delivered, please withdraw', raisedByRole: 'FREELANCER', facts });
    expect(a.action).toBe('AUTO_DISMISS');
    expect(resolveDisputeAction(a)).toBe('AUTO_DISMISS');
  });

  it('escalates a high-value dispute regardless of reason', async () => {
    const a = await adjudicateDispute({ reason: 'work not delivered', raisedByRole: 'COMPANY', facts: { ...facts, amountUsdMinor: 5_000_000 } });
    expect(a.action).toBe('ESCALATE');
  });

  it('escalates an ambiguous reason', async () => {
    const a = await adjudicateDispute({ reason: 'not happy with this', raisedByRole: 'COMPANY', facts });
    expect(a.action).toBe('ESCALATE');
  });

  it('confidence gate escalates a low-confidence auto action', () => {
    expect(resolveDisputeAction({ action: 'AUTO_REFUND', confidence: 0.5, rationale: '', by: 'ai-llm' })).toBe('ESCALATE');
    expect(resolveDisputeAction({ action: 'AUTO_REFUND', confidence: 0.9, rationale: '', by: 'ai-llm' })).toBe('AUTO_REFUND');
  });
});
