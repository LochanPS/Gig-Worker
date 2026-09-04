import { config } from "../lib/config.js";
import {
  templateExplanation,
  templateQueueSummary,
  type ExplainInput,
} from "./templates.js";

// Agent Service (TRD 4.6): the LLM explains and drafts, it never decides. The
// deterministic rule engine has already produced the verdict; here we turn the
// rule results into a plain-English reasoning trace. With no API key (or on any
// error) we fall back to the template — the demo has zero network dependency.

let client: unknown | null = null;
function getClient(): unknown | null {
  if (!config.agent.enabled) return null;
  if (client) return client;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Anthropic = require("@anthropic-ai/sdk").default;
    client = new Anthropic({ apiKey: config.agent.apiKey });
    return client;
  } catch {
    return null;
  }
}

export async function explain(input: ExplainInput): Promise<string> {
  const fallback = templateExplanation(input);
  const anthropic = getClient() as
    | { messages: { create: (a: unknown) => Promise<{ content: Array<{ type: string; text?: string }> }> } }
    | null;
  if (!anthropic) return fallback;

  try {
    const prompt = [
      "You are a compliance analyst for a cross-border payment gateway.",
      "The deterministic rule engine has ALREADY decided the verdict below.",
      "Do NOT change the decision. Write 2-4 sentences of clear, professional",
      "plain-English reasoning a compliance officer would read, grounded ONLY in",
      "the rule results provided. No markdown, no preamble.",
      "",
      `Verdict: ${input.verdict}`,
      `Payment: ${input.amountLabel} ${input.payerName} (${input.payerCountry}) -> ${input.payeeName} (${input.payeeCountry}), purpose ${input.purposeCode}.`,
      "Rule results:",
      ...input.results.map(
        (r) => `- ${r.id} [${r.severity}] ${r.triggered ? "TRIGGERED" : "ok"}: ${r.message}`,
      ),
    ].join("\n");

    const res = await anthropic.messages.create({
      model: config.agent.model,
      max_tokens: 400,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("")
      .trim();
    return text || fallback;
  } catch {
    return fallback;
  }
}

export function queueSummary(input: ExplainInput): string {
  // Kept deterministic — used in list views where latency matters.
  return templateQueueSummary(input);
}

export const agentMode = () => (config.agent.enabled ? "llm" : "template");
