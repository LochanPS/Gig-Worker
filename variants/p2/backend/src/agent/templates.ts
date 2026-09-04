import type { PurposeCode, RuleResult, Verdict } from "@gigbridge/shared";
import { PURPOSE_CODE_LABELS } from "@gigbridge/shared";

export interface ExplainInput {
  payerName: string;
  payeeName: string;
  payerCountry: string;
  payeeCountry: string;
  srcCurrency: string;
  dstCurrency: string;
  amountLabel: string; // e.g. "EUR 500.00"
  purposeCode: string;
  verdict: Verdict;
  results: RuleResult[];
}

const verdictLead: Record<Verdict, string> = {
  APPROVE: "This payment clears all compliance checks and is approved for settlement.",
  FLAG: "This payment is held for review — one or more checks require a compliance officer's attention.",
  REJECT: "This payment is blocked — a mandatory check failed and it cannot proceed.",
};

/**
 * Deterministic, demo-safe explanation. Used when ANTHROPIC_API_KEY is empty or
 * the API is unreachable. The LLM only rephrases this; the rules already decided.
 */
export function templateExplanation(input: ExplainInput): string {
  const purposeLabel =
    PURPOSE_CODE_LABELS[input.purposeCode as PurposeCode] ?? input.purposeCode;
  const triggered = input.results.filter((r) => r.triggered);
  const informative = triggered.filter((r) => r.severity === "INFO");
  const blocking = triggered.filter((r) => r.severity !== "INFO");

  const lines: string[] = [];
  lines.push(
    `${input.amountLabel} from ${input.payerName} (${input.payerCountry}) to ${input.payeeName} (${input.payeeCountry}) for ${purposeLabel} — corridor ${input.srcCurrency}->${input.dstCurrency}, purpose code ${input.purposeCode}.`,
  );
  lines.push(verdictLead[input.verdict]);

  if (blocking.length > 0) {
    lines.push("Checks needing attention:");
    for (const r of blocking) lines.push(`  • ${r.id} (${r.legalRef}): ${r.message}`);
  }
  if (informative.length > 0) {
    lines.push("Notes:");
    for (const r of informative) lines.push(`  • ${r.id}: ${r.message}`);
  }
  if (input.verdict === "APPROVE") {
    lines.push(
      "All jurisdictional gates (FEMA purpose classification, PAN thresholds, EU AMLD, OFAC screen and anomaly monitors) passed.",
    );
  }
  return lines.join("\n");
}

/** Short admin-queue summary for a flagged case. */
export function templateQueueSummary(input: ExplainInput): string {
  const flags = input.results.filter((r) => r.triggered && r.severity !== "INFO");
  const heads = flags.map((r) => r.id).join(", ") || "review";
  return `${input.amountLabel} ${input.payerName}→${input.payeeName}: ${flags.length} check(s) [${heads}] need review.`;
}
