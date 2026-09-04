// AI adjudication agent. A compliance FLAG does NOT go straight to a human — at
// 10k payments/day nobody can. This agent reads the fired rules + payment facts
// and decides: AUTO_CLEAR (release to the payer to confirm), AUTO_REJECT, or
// ESCALATE (send to the human officer). Only low-confidence / high-risk cases
// escalate — typically a small % — so the human queue stays small.
//
// Safety: the deterministic rules still own the hard verdict (BLOCK => REJECT
// happens before this). The agent only triages the grey-zone FLAGs, is
// confidence-gated, and NEVER auto-clears a sanctions or structuring hit. The LLM
// is used when configured; otherwise a deterministic heuristic runs, so behaviour
// is never blocked on the network.
import Anthropic from '@anthropic-ai/sdk';
import type { RuleResult } from '@gigbridge/shared';
import { env, hasLlm } from '../../lib/env.js';

export type AdjudicationAction = 'AUTO_CLEAR' | 'AUTO_REJECT' | 'ESCALATE';

export interface Adjudication {
  action: AdjudicationAction;
  confidence: number; // 0..1
  rationale: string;
  by: 'ai-llm' | 'ai-heuristic';
}

export interface AdjudicateInput {
  ruleResults: RuleResult[];
  facts: {
    payerName: string;
    payeeName: string;
    payeeCountry: string;
    amount: string;
    amountUsdMinor: number;
    purposeCode: string | null;
  };
}

// Confidence at/above this applies the auto action; below it we escalate.
const THRESHOLD = 0.75;
// Above this USD value we always want a human, regardless of the rules.
const HUMAN_VALUE_USD_MINOR = 2_500_000; // USD 25,000

function firedFlags(rr: RuleResult[]) {
  return rr.filter((r) => !r.passed && r.severity === 'FLAG');
}
const hits = (rr: RuleResult[], re: RegExp) => rr.some((r) => !r.passed && re.test(r.ruleId));

// Deterministic triage — the always-available fallback and the safety floor.
function heuristic(input: AdjudicateInput): Adjudication {
  const rr = input.ruleResults;
  if (hits(rr, /OFAC|SANCT/i))
    return { action: 'ESCALATE', confidence: 0.4, rationale: 'Possible sanctions/watchlist match — sanctions decisions always go to a human.', by: 'ai-heuristic' };
  if (hits(rr, /STR|structur/i))
    return { action: 'ESCALATE', confidence: 0.5, rationale: 'Structuring pattern detected — escalated for a human officer to review the sequence.', by: 'ai-heuristic' };
  if (input.facts.amountUsdMinor >= HUMAN_VALUE_USD_MINOR)
    return { action: 'ESCALATE', confidence: 0.5, rationale: 'High-value payment above the auto-clear ceiling — routed to a human.', by: 'ai-heuristic' };
  const flags = firedFlags(rr);
  if (flags.length <= 1)
    return { action: 'AUTO_CLEAR', confidence: 0.85, rationale: `Single low-severity flag (${flags[0]?.ruleId ?? 'velocity/outlier'}); within limits, no sanctions or structuring signal. Auto-cleared with an audit note.`, by: 'ai-heuristic' };
  return { action: 'ESCALATE', confidence: 0.55, rationale: `${flags.length} flags fired together — ambiguous, escalated for review.`, by: 'ai-heuristic' };
}

let client: Anthropic | null = null;
const SYSTEM = `You are the AI compliance adjudication agent for a cross-border payments platform.
A deterministic rule engine has FLAGGED a payment (grey zone — not a hard block).
Decide one action: AUTO_CLEAR (safe to proceed), AUTO_REJECT (clear breach), or
ESCALATE (a human officer must decide). Hard rules you must follow:
- NEVER AUTO_CLEAR when a sanctions/OFAC or structuring rule fired — ESCALATE.
- Prefer ESCALATE when unsure. Only AUTO_CLEAR clearly benign, low-value cases.
Reply with ONLY compact JSON: {"action":"AUTO_CLEAR|AUTO_REJECT|ESCALATE","confidence":0-1,"rationale":"one sentence"}.`;

export async function adjudicate(input: AdjudicateInput): Promise<Adjudication> {
  const floor = heuristic(input);
  // Safety floor: if the heuristic says escalate for sanctions/structuring/value,
  // don't let the LLM override that into an auto action.
  const mustEscalate = floor.action === 'ESCALATE' && floor.confidence <= 0.5;
  if (!hasLlm || mustEscalate) return floor;
  try {
    if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const rulesText = input.ruleResults
      .map((r) => `- ${r.ruleId} [${r.jurisdiction}] ${r.passed ? 'PASS' : 'FAIL'} (${r.severity}): ${r.message}`)
      .join('\n');
    const res = await client.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 200,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Payment: ${input.facts.payerName} → ${input.facts.payeeName} (${input.facts.payeeCountry}), ${input.facts.amount}, purpose ${input.facts.purposeCode ?? 'n/a'}.\nRules:\n${rulesText}` }],
    });
    const block = res.content.find((b) => b.type === 'text');
    const raw = block && 'text' in block ? block.text : '';
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    const action = (['AUTO_CLEAR', 'AUTO_REJECT', 'ESCALATE'] as const).includes(json.action) ? json.action : 'ESCALATE';
    const confidence = Math.max(0, Math.min(1, Number(json.confidence) || 0));
    // Never auto-clear a sanctions/structuring hit even if the model tries.
    if (action === 'AUTO_CLEAR' && (hits(input.ruleResults, /OFAC|SANCT/i) || hits(input.ruleResults, /STR|structur/i)))
      return { action: 'ESCALATE', confidence: 0.4, rationale: 'Sanctions/structuring signal present — overriding to human review.', by: 'ai-llm' };
    return { action, confidence, rationale: String(json.rationale || floor.rationale).slice(0, 300), by: 'ai-llm' };
  } catch {
    return floor;
  }
}

// Apply the confidence gate: only auto-act when confident enough.
export function resolveAction(a: Adjudication): AdjudicationAction {
  if (a.action === 'ESCALATE') return 'ESCALATE';
  return a.confidence >= THRESHOLD ? a.action : 'ESCALATE';
}
