// Rule contract. Every rule is a pure function over an EvalContext, returning a
// RuleResult. The engine builds the context (DB lookups, FX conversion) once and
// runs all rules against it, then aggregates verdicts.
import type { RuleResult, Currency } from '@gigbridge/shared';

export interface Party {
  id: string;
  name: string;
  country: string; // ISO alpha-2
  role: string;
  panOrTaxId: string | null;
  kycStatus: string;
}

export interface HistoryItem {
  id: string;
  srcAmountMinor: number;
  srcCurrency: string;
  createdAt: Date;
}

export interface EvalContext {
  payer: Party;
  payee: Party;
  srcCurrency: Currency;
  dstCurrency: Currency;
  srcAmountMinor: number;
  purposeCode: string | null;
  // amount converted into a target currency's minor units (for threshold checks).
  toMinor: (currency: Currency) => number;
  sanctionsHitPayer: boolean;
  sanctionsHitPayee: boolean;
  // payer's recent payments to THIS payee, newest first (for velocity/structuring).
  historyToPayee: HistoryItem[];
  // payee's trailing average received (src-normalized minor USD) for outlier checks.
  payeeTrailingAvgUsdMinor: number;
}

export interface Rule {
  id: string;
  jurisdiction: RuleResult['jurisdiction'];
  legalRef: string;
  severity: RuleResult['severity']; // severity if the rule FAILS
  evaluate: (ctx: EvalContext) => { passed: boolean; message: string };
}

export function toResult(rule: Rule, ctx: EvalContext): RuleResult {
  const { passed, message } = rule.evaluate(ctx);
  return {
    ruleId: rule.id,
    jurisdiction: rule.jurisdiction,
    passed,
    severity: rule.severity,
    legalRef: rule.legalRef,
    message,
  };
}
