// Agent service (step 6). Turns deterministic rule results into a plain-English
// reasoning trace via Claude. The LLM ONLY explains — it never decides. When no
// API key is configured (or the call fails), the step-5 template is used, so the
// demo is never blocked on network (NFR-4, ROADMAP risk R2).
import Anthropic from '@anthropic-ai/sdk';
import type { Verdict, RuleResult } from '@gigbridge/shared';
import { env, hasLlm } from '../../lib/env.js';

export interface ExplainInput {
  verdict: Verdict;
  ruleResults: RuleResult[];
  facts: {
    payerName: string;
    payerCountry: string;
    payeeName: string;
    payeeCountry: string;
    amount: string; // formatted, e.g. "EUR 500.00"
    purposeCode: string | null;
  };
  fallback: string; // deterministic template explanation (always available)
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM = `You are the compliance-explanation agent for GigBridge, a cross-border payment gateway.
A deterministic rule engine has ALREADY decided the verdict — you do not change it.
Your job: explain, in 2-4 clear sentences, why this decision was reached, for a human
reviewer. Reference the specific rules that fired and the jurisdictions involved
(India RBI/FEMA, EU AMLD/GDPR, US OFAC). Be precise and neutral. Do not invent facts
beyond the rule results and payment facts given. Do not output a verdict word as a
heading; write flowing prose.`;

export async function explainDecision(input: ExplainInput): Promise<string> {
  if (!hasLlm) return input.fallback;
  try {
    const rulesText = input.ruleResults
      .map((r) => `- ${r.ruleId} [${r.jurisdiction}] ${r.passed ? 'PASS' : 'FAIL'} (${r.severity}): ${r.message}`)
      .join('\n');
    const userMsg = `Payment facts:
- From: ${input.facts.payerName} (${input.facts.payerCountry})
- To: ${input.facts.payeeName} (${input.facts.payeeCountry})
- Amount: ${input.facts.amount}
- Purpose code: ${input.facts.purposeCode ?? 'n/a'}

Engine verdict: ${input.verdict}

Rule results:
${rulesText}

Write the reviewer-facing explanation.`;

    const res = await getClient().messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    });
    const text = res.content.find((b) => b.type === 'text');
    return text && 'text' in text ? text.text.trim() : input.fallback;
  } catch {
    // Any failure (no network, rate limit, bad key) -> deterministic fallback.
    return input.fallback;
  }
}
