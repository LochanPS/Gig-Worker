// AI adjudicator — heuristic path (no API key in test, so the deterministic
// floor runs). Verifies the safety rules: sanctions/structuring always escalate,
// a lone low-severity flag auto-clears, and the confidence gate holds.
import { describe, it, expect } from 'vitest';
import { adjudicate, resolveAction } from './adjudicator.js';
import type { RuleResult } from '@gigbridge/shared';

const rule = (ruleId: string, passed: boolean, severity: RuleResult['severity']): RuleResult => ({
  ruleId, jurisdiction: 'EU', passed, severity, legalRef: 'x', message: ruleId,
});
const facts = { payerName: 'Novatek', payeeName: 'Priya', payeeCountry: 'IN', amount: 'EUR 500.00', amountUsdMinor: 54000, purposeCode: 'P0802' };

describe('AI adjudicator (heuristic)', () => {
  it('escalates a sanctions hit — never auto-clears', async () => {
    const a = await adjudicate({ ruleResults: [rule('US-OFAC-001', false, 'FLAG')], facts });
    expect(a.action).toBe('ESCALATE');
    expect(resolveAction(a)).toBe('ESCALATE');
  });

  it('escalates a structuring pattern', async () => {
    const a = await adjudicate({ ruleResults: [rule('GB-STR-001', false, 'FLAG')], facts });
    expect(a.action).toBe('ESCALATE');
  });

  it('auto-clears a single low-severity velocity flag', async () => {
    const a = await adjudicate({ ruleResults: [rule('GB-VEL-001', false, 'FLAG')], facts });
    expect(a.action).toBe('AUTO_CLEAR');
    expect(resolveAction(a)).toBe('AUTO_CLEAR');
  });

  it('escalates a high-value payment even when the flag is benign', async () => {
    const a = await adjudicate({ ruleResults: [rule('GB-VEL-001', false, 'FLAG')], facts: { ...facts, amountUsdMinor: 5_000_000 } });
    expect(a.action).toBe('ESCALATE');
  });

  it('escalates when multiple flags fire together', async () => {
    const a = await adjudicate({ ruleResults: [rule('GB-VEL-001', false, 'FLAG'), rule('GB-OUT-001', false, 'FLAG')], facts });
    expect(a.action).toBe('ESCALATE');
  });

  it('confidence gate escalates a low-confidence auto action', () => {
    expect(resolveAction({ action: 'AUTO_CLEAR', confidence: 0.5, rationale: '', by: 'ai-llm' })).toBe('ESCALATE');
    expect(resolveAction({ action: 'AUTO_CLEAR', confidence: 0.9, rationale: '', by: 'ai-llm' })).toBe('AUTO_CLEAR');
  });
});
