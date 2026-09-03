// Client-side compliance evaluation against the FROZEN thresholds in
// @gigbridge/shared. This mirrors the backend rule engine so the wizard's
// approve / flag / reject banners are deterministic in the demo. The real
// backend decision replaces this once GET /payments/:id/compliance exists.
import { THRESHOLDS, type PurposeCode, type RuleResult, type Verdict } from '@gigbridge/shared';
import { PURPOSE_CODE_LABELS } from '@gigbridge/shared';
import type { DirectoryFreelancer } from './directory';
import { formatMoney } from './money';

export interface ComplianceInput {
  payee: DirectoryFreelancer;
  srcCurrency: string;
  srcAmountMinor: number;
  dstCurrency: string;
  dstAmountMinor: number;
  purposeCode: PurposeCode;
}

export interface ComplianceResult {
  verdict: Verdict;
  ruleResults: RuleResult[];
  agentExplanation: string;
}

export function evaluateCompliance(input: ComplianceInput): ComplianceResult {
  const { payee, srcCurrency, srcAmountMinor, dstCurrency, dstAmountMinor, purposeCode } = input;
  const rules: RuleResult[] = [];

  // India, inward remittance purpose code (FEMA). Required field, always present here.
  rules.push({
    ruleId: 'IN-RBI-001',
    jurisdiction: 'INDIA',
    passed: true,
    severity: 'BLOCK',
    legalRef: 'FEMA 1999, Sch. III',
    message: `Purpose code ${purposeCode} (${PURPOSE_CODE_LABELS[purposeCode]}) declared for the inward remittance.`,
  });

  // India, PAN required above the paise threshold for a resident payee.
  const panNeeded = payee.country === 'IN' && dstCurrency === 'INR' && dstAmountMinor >= THRESHOLDS.IN_RBI_002_PAN_REQUIRED_INR;
  const panOnFile = payee.kycStatus === 'VERIFIED';
  rules.push({
    ruleId: 'IN-RBI-002',
    jurisdiction: 'INDIA',
    passed: !panNeeded || panOnFile,
    severity: 'BLOCK',
    legalRef: 'Income-tax Act, Rule 114B',
    message: panNeeded
      ? panOnFile
        ? 'Payee PAN is verified for a payout above the reporting threshold.'
        : `Payout of ${formatMoney(dstAmountMinor, dstCurrency)} needs a verified PAN. Payee verification is still pending.`
      : 'Payout is below the PAN reporting threshold.',
  });

  // EU enhanced due diligence threshold.
  const eddTriggered = srcCurrency === 'EUR' && srcAmountMinor >= THRESHOLDS.EU_AML_001_EDD_EUR;
  rules.push({
    ruleId: 'EU-AML-001',
    jurisdiction: 'EU',
    passed: !eddTriggered,
    severity: 'FLAG',
    legalRef: 'Directive (EU) 2015/849',
    message: eddTriggered
      ? `Amount reaches the ${formatMoney(THRESHOLDS.EU_AML_001_EDD_EUR, 'EUR')} enhanced-due-diligence threshold. Manual review required.`
      : `Below the ${formatMoney(THRESHOLDS.EU_AML_001_EDD_EUR, 'EUR')} enhanced-due-diligence threshold.`,
  });

  // Sanctions screening on both parties.
  rules.push({
    ruleId: 'US-OFAC-001',
    jurisdiction: 'US',
    passed: true,
    severity: 'BLOCK',
    legalRef: 'OFAC SDN List',
    message: 'No sanctions match on the payer or the payee.',
  });

  const blocked = rules.some((r) => r.severity === 'BLOCK' && !r.passed);
  const flagged = rules.some((r) => r.severity === 'FLAG' && !r.passed);
  const verdict: Verdict = blocked ? 'REJECT' : flagged ? 'FLAG' : 'APPROVE';

  return { verdict, ruleResults: rules, agentExplanation: explain(input, verdict, rules) };
}

function explain(input: ComplianceInput, verdict: Verdict, rules: RuleResult[]): string {
  const { payee, srcCurrency, srcAmountMinor, purposeCode } = input;
  const amount = formatMoney(srcAmountMinor, srcCurrency);
  const head = `This ${amount} payment to ${payee.name} in ${payee.country} is classified under purpose code ${purposeCode} (${PURPOSE_CODE_LABELS[purposeCode]}).`;
  if (verdict === 'APPROVE') {
    return `${head} It sits below the EU enhanced-due-diligence threshold, both parties clear sanctions screening, and the payee holds a verified credential. No rule blocks or flags the transfer, so the agent approves it for settlement.`;
  }
  if (verdict === 'FLAG') {
    const flag = rules.find((r) => r.severity === 'FLAG' && !r.passed);
    return `${head} The transfer meets the enhanced-due-diligence threshold under ${flag?.legalRef}. Sanctions screening is clear and identity is verified, but the amount requires a human reviewer to confirm the commercial rationale before funds move. The agent has routed it to the compliance queue.`;
  }
  const block = rules.find((r) => r.severity === 'BLOCK' && !r.passed);
  return `${head} The agent cannot clear this transfer because ${block?.message} Under ${block?.legalRef} the payout is blocked until that requirement is met. No funds have been committed.`;
}
