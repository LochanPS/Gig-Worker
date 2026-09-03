// With no ANTHROPIC_API_KEY set (the test default), the agent must return the
// deterministic template fallback verbatim — proving the demo is never network-bound.
import { describe, it, expect } from 'vitest';
import { explainDecision } from './agent.service.js';

describe('agent service (no API key)', () => {
  it('returns the template fallback when no LLM is configured', async () => {
    const fallback = 'EUR 500.00 from Novatek GmbH (DE) to Priya (IN): approved.';
    const out = await explainDecision({
      verdict: 'APPROVE',
      ruleResults: [
        { ruleId: 'IN-RBI-001', jurisdiction: 'INDIA', passed: true, severity: 'BLOCK', legalRef: 'FEMA', message: 'ok' },
      ],
      facts: { payerName: 'Novatek GmbH', payerCountry: 'DE', payeeName: 'Priya', payeeCountry: 'IN', amount: 'EUR 500.00', purposeCode: 'P0802' },
      fallback,
    });
    expect(out).toBe(fallback);
  });
});
