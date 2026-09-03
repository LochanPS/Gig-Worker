// Compliance port. Step 3 ships a permissive stub (always APPROVE) so the
// orchestrator lifecycle works. Step 5 replaces `evaluate` with the real
// deterministic rule engine + agent explanation, same signature.
import { createHash } from 'node:crypto';
import type { Verdict, RuleResult } from '@gigbridge/shared';

export interface ComplianceContext {
  srcCurrency: string;
  dstCurrency: string;
  srcAmountMinor: number;
  purposeCode: string | null;
  payerId: string;
  payeeId: string;
}

export interface ComplianceOutcome {
  verdict: Verdict;
  ruleResults: RuleResult[];
  agentExplanation: string;
  decisionHash: string;
}

export type ComplianceEngine = (ctx: ComplianceContext) => Promise<ComplianceOutcome>;

export function hashDecision(verdict: Verdict, ruleResults: RuleResult[]): string {
  return '0x' + createHash('sha256').update(JSON.stringify({ verdict, ruleResults })).digest('hex');
}

// Permissive placeholder.
const stubEngine: ComplianceEngine = async () => {
  const ruleResults: RuleResult[] = [
    { ruleId: 'STUB-001', jurisdiction: 'PLATFORM', passed: true, severity: 'INFO', legalRef: 'n/a', message: 'Stub engine — real rules land in step 5.' },
  ];
  return { verdict: 'APPROVE', ruleResults, agentExplanation: 'Approved by stub compliance engine.', decisionHash: hashDecision('APPROVE', ruleResults) };
};

let active: ComplianceEngine = stubEngine;
export const getComplianceEngine = (): ComplianceEngine => active;
export const setComplianceEngine = (e: ComplianceEngine): void => {
  active = e;
};
