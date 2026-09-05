// AI dispute-triage agent (roadmap #1). Mirrors the payment adjudicator: when a
// dispute is opened it does NOT go straight to a human. This agent reads the
// dispute reason + facts and recommends AUTO_REFUND (reverse to the payer — the
// work clearly was not delivered), AUTO_DISMISS (payment stands — delivered or the
// dispute was withdrawn), or ESCALATE (a human officer must decide). Only confident,
// low-risk cases auto-resolve; fraud/sanctions/legal claims and high-value disputes
// ALWAYS escalate. The LLM is used when configured; otherwise a deterministic
// heuristic runs, so behaviour is never blocked on the network.
import Anthropic from '@anthropic-ai/sdk';
import type { Role } from '@gigbridge/shared';
import { env, hasLlm } from '../../lib/env.js';

export type DisputeAction = 'AUTO_REFUND' | 'AUTO_DISMISS' | 'ESCALATE';

export interface DisputeAdjudication {
  action: DisputeAction;
  confidence: number; // 0..1
  rationale: string;
  by: 'ai-llm' | 'ai-heuristic';
}

export interface DisputeAdjudicateInput {
  reason: string;
  raisedByRole: Role;
  facts: { payerName: string; payeeName: string; amountUsdMinor: number };
}

// Confidence at/above this applies the auto action; below it we escalate.
const THRESHOLD = 0.75;
// Above this USD value a dispute always goes to a human, whatever the reason.
const HUMAN_VALUE_USD_MINOR = 2_500_000; // USD 25,000

// Reason signals. SERIOUS always escalates (never auto-resolve a fraud/legal claim).
const SERIOUS = /fraud|scam|launder|sanction|stolen|unauthor|chargeback|police|legal|court|lawsuit|threat/i;
const NONDELIVERY = /not\s+deliver|no\s+work|nothing\s+(delivered|received|done)|never\s+(received|got|delivered)|incomplete|did\s?n'?t\s+deliver|no[-\s]?show|undeliver|failed\s+to\s+deliver|work\s+not\s+done|no\s+deliverable/i;
const SATISFIED = /deliver(ed|y\s+done)|work\s+(done|delivered)|completed|satisfied|resolved|by\s+mistake|mistake|withdraw|changed?\s+my\s+mind|sorted|received\s+it|all\s+good|no\s+longer\s+dispute/i;

// Deterministic triage — the always-available fallback and the safety floor.
function heuristic(input: DisputeAdjudicateInput): DisputeAdjudication {
  const r = input.reason;
  if (SERIOUS.test(r))
    return { action: 'ESCALATE', confidence: 0.4, rationale: 'Dispute alleges fraud / sanctions / legal grounds — always routed to a human officer.', by: 'ai-heuristic' };
  if (input.facts.amountUsdMinor >= HUMAN_VALUE_USD_MINOR)
    return { action: 'ESCALATE', confidence: 0.5, rationale: 'High-value dispute above the auto-resolve ceiling — a human decides.', by: 'ai-heuristic' };
  if (NONDELIVERY.test(r))
    return { action: 'AUTO_REFUND', confidence: 0.82, rationale: 'Reason describes non-delivery / no work received — recommend reversing the payment to the payer.', by: 'ai-heuristic' };
  if (SATISFIED.test(r))
    return { action: 'AUTO_DISMISS', confidence: 0.82, rationale: 'Reason indicates the work was delivered or the dispute was withdrawn — recommend dismissing; the payment stands.', by: 'ai-heuristic' };
  return { action: 'ESCALATE', confidence: 0.5, rationale: 'Dispute reason is ambiguous — escalated for a human officer to decide.', by: 'ai-heuristic' };
}

let client: Anthropic | null = null;
const SYSTEM = `You are the AI dispute-triage agent for a cross-border payments platform.
A party opened a dispute on a COMPLETED payment (now held pending review). Decide one
action: AUTO_REFUND (reverse to the payer — the work clearly was not delivered),
AUTO_DISMISS (the payment stands — work delivered or the dispute was withdrawn), or
ESCALATE (a human officer must decide). Hard rules you must follow:
- ALWAYS ESCALATE if the dispute alleges fraud, sanctions, laundering, or legal action.
- Prefer ESCALATE when unsure. Only auto-resolve clear, low-value cases.
Reply with ONLY compact JSON: {"action":"AUTO_REFUND|AUTO_DISMISS|ESCALATE","confidence":0-1,"rationale":"one sentence"}.`;

export async function adjudicateDispute(input: DisputeAdjudicateInput): Promise<DisputeAdjudication> {
  const floor = heuristic(input);
  // Safety floor: a serious/high-value escalation is never overridden by the LLM.
  const mustEscalate = floor.action === 'ESCALATE' && floor.confidence <= 0.5;
  if (!hasLlm || mustEscalate) return floor;
  try {
    if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 200,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Dispute raised by the ${input.raisedByRole} on a payment ${input.facts.payerName} → ${input.facts.payeeName} (~USD ${(input.facts.amountUsdMinor / 100).toFixed(0)}).\nReason: "${input.reason}"`,
        },
      ],
    });
    const block = res.content.find((b) => b.type === 'text');
    const raw = block && 'text' in block ? block.text : '';
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    const action = (['AUTO_REFUND', 'AUTO_DISMISS', 'ESCALATE'] as const).includes(json.action) ? json.action : 'ESCALATE';
    const confidence = Math.max(0, Math.min(1, Number(json.confidence) || 0));
    // Never auto-resolve a serious claim even if the model tries.
    if (action !== 'ESCALATE' && SERIOUS.test(input.reason))
      return { action: 'ESCALATE', confidence: 0.4, rationale: 'Fraud/sanctions/legal signal present — overriding to human review.', by: 'ai-llm' };
    return { action, confidence, rationale: String(json.rationale || floor.rationale).slice(0, 300), by: 'ai-llm' };
  } catch {
    return floor;
  }
}

// Apply the confidence gate: only auto-act when confident enough, else escalate.
export function resolveDisputeAction(a: DisputeAdjudication): DisputeAction {
  if (a.action === 'ESCALATE') return 'ESCALATE';
  return a.confidence >= THRESHOLD ? a.action : 'ESCALATE';
}
