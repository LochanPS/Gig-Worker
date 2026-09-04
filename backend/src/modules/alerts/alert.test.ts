// Tests the rule -> alert mapping logic without a DB (pure classification).
import { describe, it, expect } from 'vitest';
import { RULE_TO_ALERT_FOR_TEST } from './alert.mapping.js';
import type { RuleResult } from '@gigbridge/shared';

const failed = (ruleId: string): RuleResult => ({
  ruleId, jurisdiction: 'PLATFORM', passed: false, severity: 'FLAG', legalRef: 'x', message: 'hit',
});

describe('alert mapping', () => {
  it('maps structuring to a HIGH alert', () => {
    expect(RULE_TO_ALERT_FOR_TEST['GB-STR-001']).toEqual({ type: 'STRUCTURING', severity: 'HIGH' });
  });

  it('maps a sanctions block to a SANCTIONS alert', () => {
    expect(RULE_TO_ALERT_FOR_TEST['US-OFAC-001'].type).toBe('SANCTIONS');
  });

  it('only anomaly/sanctions rules produce alerts', () => {
    const alertable = ['GB-VEL-001', 'GB-STR-001', 'GB-OUT-001', 'US-OFAC-001'];
    for (const id of alertable) expect(RULE_TO_ALERT_FOR_TEST[id]).toBeDefined();
    // A jurisdiction rule like IN-RBI-001 must NOT raise an alert.
    expect(RULE_TO_ALERT_FOR_TEST[failed('IN-RBI-001').ruleId]).toBeUndefined();
  });
});
