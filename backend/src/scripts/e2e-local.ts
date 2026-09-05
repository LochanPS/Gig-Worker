/**
 * End-to-end check against a RUNNING backend, driving the real REST API exactly as
 * the UI does. Verifies the whole payment loop plus the surfaces the demo depends on,
 * so a regression shows up here rather than on stage.
 *
 *   pnpm --filter ./backend e2e:local        # backend must be up on :4000
 *
 * Works in simulated OR real settlement mode — it reports which one the backend is in
 * and asserts the lifecycle either way. It does NOT verify anything on-chain; for that
 * run `pnpm --filter ./contracts preflight:chain` and `smoke:testnet`.
 *
 * Assumes a freshly seeded database (`pnpm demo:reset`): it creates new payments, so
 * running it twice is fine, but it does raise a dispute on the payment it creates.
 */
/* eslint-disable @typescript-eslint/no-explicit-any --
   This script asserts against raw API responses on purpose: typing them against the
   shared DTOs would make it agree with the frontend's assumptions rather than check
   what the server actually sent, which is the whole point of an end-to-end check. */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const ORIGIN = BASE.replace(/\/api\/v1$/, '');

let failures = 0;
const ok = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m: string) => { failures++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };
const check = (cond: boolean, m: string) => (cond ? ok(m) : bad(m));
const head = (m: string) => console.log(`\n${m}`);

interface Opts { method?: string; token?: string; body?: unknown }
async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    method: opts.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${opts.method ?? 'GET'} ${path} -> ${res.status}: ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}
const login = (email: string) => api<any>('/auth/login', { method: 'POST', body: { email, password: 'demo1234' } });

async function main() {
  head('1. Backend reachable, and which settlement mode is it really in?');
  const meta = await api<any>('/meta');
  ok(`settlementMode = ${meta.settlementMode}${meta.chainId ? ` (chain ${meta.chainId})` : ''}`);
  const onChain = meta.settlementMode === 'real';
  const [co, pr, ad] = await Promise.all([login('novatek@demo.gg'), login('priya@demo.gg'), login('admin@demo.gg')]);
  ok('company, freelancer and admin can all log in');

  head('2. Credential hash agrees with the chain derivation');
  const { keccak256, toBytes } = await import('viem');
  const cred = await api<any>('/credentials/me', { token: pr.token });
  check(cred.hash === keccak256(toBytes(pr.user.id)), `DB credential hash === keccak256(toBytes(userId)) — ${String(cred.hash).slice(0, 20)}…`);

  head('3. EUR 500, Novatek -> Priya: compliance decision');
  const created = await api<any>('/payments', {
    method: 'POST', token: co.token,
    body: { payeeId: pr.user.id, srcCurrency: 'EUR', dstCurrency: 'INR', srcAmountMinor: 50_000, purposeCode: 'P0802' },
  });
  check(created.decision.verdict === 'APPROVE', `verdict = ${created.decision.verdict}`);
  const rules = created.decision.ruleResults ?? [];
  check(Array.isArray(rules) && rules.length > 0, `ruleResults present (${rules.length}) — this is what the UI tick-list renders`);
  check(rules.every((r: any) => r.ruleId && r.legalRef && r.message), 'every rule carries ruleId + legalRef + message');
  ok(`jurisdictions screened: ${[...new Set(rules.map((r: any) => r.jurisdiction))].join(', ')}`);
  ok(`fee ${(created.quote.feeMinor / 100).toFixed(2)} EUR vs incumbent ${(created.quote.incumbentFeeMinor / 100).toFixed(2)} EUR`);

  head('4. Settle it');
  const done = await api<any>(`/payments/${created.payment.id}/confirm`, { method: 'POST', token: co.token, body: { quoteId: created.quote.quoteId } });
  check(done.state === 'COMPLETED', `state = ${done.state}`);
  check(!!done.txHashFund && !!done.txHashRelease, `fund + release tx hashes recorded${onChain ? '' : ' (simulated — placeholders)'}`);
  check(done.timeline.some((t: any) => t.key === 'FUNDED'), 'FUNDED step recorded');
  check(done.timeline.some((t: any) => t.key === 'RELEASED'), 'RELEASED step recorded');

  head('5. The INR last mile');
  check(done.payoutMethod === 'UPI', `payoutMethod = ${done.payoutMethod} (the seeded UPI account should win over the bank one)`);
  const credited = done.timeline.find((t: any) => t.key === 'CREDITED');
  const detail = (credited?.detail ?? {}) as Record<string, string>;
  check(!!detail.upiIntent && detail.upiIntent.startsWith('upi://pay?'), 'a upi:// intent was recorded — without this the QR card cannot render');
  check(!!detail.vpaMasked, `masked VPA = ${detail.vpaMasked}`);
  if (detail.upiIntent) console.log(`    ${detail.upiIntent}`);

  head('6. Documents');
  const docs = await api<any[]>(`/payments/${done.id}/documents`, { token: co.token });
  check(docs.some((d) => /firc/i.test(d.title) && d.available), 'FIRC available');
  for (const doc of docs.filter((d) => d.available)) {
    const r = await fetch(ORIGIN + doc.url, { headers: { authorization: `Bearer ${co.token}` } });
    const html = await r.text();
    check(r.ok && html.length > 200, `${doc.title} renders (${html.length} bytes)`);
  }

  head('7. AI dispute triage actually acts');
  const disp = await api<any>('/disputes', {
    method: 'POST', token: pr.token,
    body: { paymentId: done.id, reason: 'Work was never delivered, no files received at all' },
  });
  // A clear non-delivery is a confident AUTO_REFUND, so the agent should close it
  // itself. Staying OPEN with an empty note is the signature of a swallowed failure.
  check(disp.status !== 'OPEN' || !!disp.resolutionNote, `status = ${disp.status}, note ${disp.resolutionNote ? 'written' : 'MISSING (triage silently failed)'}`);
  check(!!disp.resolutionNote && /\[[A-Z_]+ · \d+% confidence\]/.test(disp.resolutionNote), `note parses for the UI: ${String(disp.resolutionNote).slice(0, 60)}…`);
  if (disp.status !== 'OPEN') check(!!disp.resolvedByAgent, `attributed to ${disp.resolvedByAgent} with resolvedById null (it is a FK to User)`);
  const allDisputes = await api<any[]>('/disputes', { token: ad.token });
  check(allDisputes.length > 0, `admin sees ${allDisputes.length} dispute(s), resolved ones included`);

  head('8. A flagged payment reaches the operator with its reasons');
  const big = await api<any>('/payments', {
    method: 'POST', token: co.token,
    body: { payeeId: pr.user.id, srcCurrency: 'EUR', dstCurrency: 'INR', srcAmountMinor: 1_200_000, purposeCode: 'P0802' },
  });
  check(big.decision.verdict === 'FLAG', `EUR 12,000 verdict = ${big.decision.verdict}`);
  ok(`failing rules: ${big.decision.ruleResults.filter((r: any) => !r.passed).map((r: any) => `${r.ruleId}(${r.severity})`).join(', ')}`);
  const queue = await api<any[]>('/admin/queue', { token: ad.token });
  check(queue.length > 0 && Array.isArray(queue[0].ruleResults), 'queue items carry ruleResults for the "Why it flagged" panel');

  head('9. A sanctioned payee is refused');
  const dir = await api<any[]>('/directory/freelancers', { token: co.token });
  const sanctioned = dir.find((f) => /sanctioned/i.test(f.name));
  if (!sanctioned) { bad('no sanctioned actor in the directory — is the DB seeded?'); }
  else {
    const rej = await api<any>('/payments', {
      method: 'POST', token: co.token,
      body: { payeeId: sanctioned.id, srcCurrency: 'EUR', dstCurrency: 'INR', srcAmountMinor: 50_000, purposeCode: 'P0802' },
    });
    check(rej.decision.verdict === 'REJECT', `verdict = ${rej.decision.verdict}`);
    const ofac = rej.decision.ruleResults.find((r: any) => r.ruleId === 'US-OFAC-001');
    check(!!ofac && !ofac.passed, `US-OFAC-001 failed with severity ${ofac?.severity}`);
  }

  console.log(`\n${'─'.repeat(64)}`);
  if (failures === 0) {
    console.log(`\x1b[32mE2E PASSED\x1b[0m — settlement mode: ${meta.settlementMode}`);
    if (!onChain) console.log('Note: simulated mode. The chain half is proven by preflight:chain + smoke:testnet.');
  } else {
    console.log(`\x1b[31mE2E FAILED — ${failures} check(s)\x1b[0m`);
  }
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\ne2e crashed: ${(err as Error).message}`);
  console.error('Is the backend running on :4000 and the database seeded?');
  process.exit(1);
});
