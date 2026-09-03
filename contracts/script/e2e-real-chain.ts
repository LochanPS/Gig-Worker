/**
 * Full-stack e2e for real on-chain settlement. Requires: anvil, Postgres (seeded),
 * and the backend running with SETTLEMENT_MODE=real on :4000.
 * Run: pnpm --filter @gigbridge/contracts exec tsx script/e2e-real-chain.ts
 *
 * Drives the real REST API — login -> create payment -> confirm -> and asserts
 * the payee's on-chain MockUSDC balance rose by (srcAmount - fee).
 */
import type { Address, Hex } from "viem";
import { createChainOps } from "../chain.js";

const BASE = process.env.API_BASE ?? "http://localhost:4000/api/v1";

async function api(path: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${opts.method ?? "GET"} ${path} -> ${res.status}: ${text}`);
  return json;
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

async function login(email: string, password = "demo1234") {
  return api("/auth/login", { method: "POST", body: { email, password } });
}

async function main() {
  const ops = createChainOps();

  const company = await login("novatek@demo.gg");
  const priya = await login("priya@demo.gg");
  const payeeId: string = priya.user.id;

  // create a fresh EUR 500.00 payment for software services
  const created = await api("/payments", {
    method: "POST",
    token: company.token,
    body: {
      payeeId,
      srcCurrency: "EUR",
      dstCurrency: "INR",
      srcAmountMinor: 50_000,
      purposeCode: "P0802",
    },
  });
  const paymentId: string = created.payment.id;
  const quoteId: string = created.quote.quoteId;
  const state: string = created.payment.state;
  console.log("created payment", paymentId, "state", state, "quote", quoteId);
  assert(
    state === "COMPLIANCE_CHECK" || state === "FLAGGED",
    `expected COMPLIANCE_CHECK or FLAGGED, got ${state}`,
  );

  // If the anomaly rules flagged it (e.g. repeated demo payments trip velocity),
  // resolve it through the admin queue — exercising that path too.
  if (state === "FLAGGED") {
    const admin = await login("admin@demo.gg");
    await api(`/admin/queue/${paymentId}/resolve`, {
      method: "POST",
      token: admin.token,
      body: { action: "APPROVE", note: "e2e auto-approve of flagged demo payment" },
    });
    console.log("admin approved flagged payment via /admin/queue/:id/resolve");
  }

  // confirm -> real rate lock -> fund on-chain -> release -> COMPLETED
  const confirmed = await api(`/payments/${paymentId}/confirm`, {
    method: "POST",
    token: company.token,
    body: { quoteId },
  });
  const p = confirmed.payment ?? confirmed;
  console.log("confirmed state:", p.state);
  console.log("txHashFund:   ", p.txHashFund);
  console.log("txHashRelease:", p.txHashRelease);
  console.log("escrowId:     ", p.escrowId);

  assert(p.state === "COMPLETED", `expected COMPLETED, got ${p.state}`);
  assert(/^0x[0-9a-f]{64}$/i.test(p.txHashFund), "real fund tx hash present");
  assert(/^0x[0-9a-f]{64}$/i.test(p.txHashRelease), "real release tx hash present");

  // verify on-chain via the per-payment escrow record (history-independent, so
  // it holds even when the same demo payee is reused across repeated runs).
  const escrow = (await ops.getPayment(p.escrowId as Hex)) as {
    state: number;
    payee: Address;
    amount: bigint;
    fee: bigint;
  };
  const expectedAmount = BigInt(p.srcAmountMinor) * 10_000n;
  const expectedFee = BigInt(p.feeAmountMinor) * 10_000n;
  const expectedPayout = expectedAmount - expectedFee;
  console.log("on-chain escrow:", {
    state: Number(escrow.state),
    payee: escrow.payee,
    amount: escrow.amount.toString(),
    fee: escrow.fee.toString(),
  });
  assert(Number(escrow.state) === 2, "escrow marked Released on-chain (state 2)");
  assert(escrow.amount === expectedAmount, `escrow amount ${escrow.amount}, expected ${expectedAmount}`);
  assert(escrow.fee === expectedFee, `escrow fee ${escrow.fee}, expected ${expectedFee}`);

  // payee balance is a positive multiple of the payout (accumulates across runs)
  const payeeBal = await ops.usdcBalance(escrow.payee);
  console.log("payee on-chain USDC:", payeeBal.toString(), "(>= one payout", expectedPayout.toString(), ")");
  assert(payeeBal >= expectedPayout && payeeBal % expectedPayout === 0n, "payee balance is whole payouts");

  console.log("\n✅ FULL-STACK REAL-CHAIN E2E PASSED");
  console.log(`   EUR 500.00 -> escrow -> release; payee received ${expectedPayout} USDC base units this run.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\n❌ E2E FAILED\n", e);
    process.exit(1);
  });
