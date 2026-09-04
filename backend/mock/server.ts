// Trivial mock API server (BUILD_CONTRACTS §4). Serves every REST path with
// seed-shaped fake data and NO database, so the frontend (P3) can build against
// the frozen contract before the real backend lands. Run: `pnpm dev:mock`.
import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import type {
  PaymentDTO,
  FxQuoteDTO,
  AdminMetricsDTO,
  Corridor,
} from "@gigbridge/shared";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const now = () => new Date().toISOString();
const users = {
  novatek: { id: "11111111-1111-4111-8111-111111111111", name: "Novatek GmbH", role: "COMPANY" },
  priya: { id: "22222222-2222-4222-8222-222222222222", name: "Priya Sharma", role: "FREELANCER" },
  admin: { id: "33333333-3333-4333-8333-333333333333", name: "Platform Admin", role: "ADMIN" },
};

function fakePayment(state: PaymentDTO["state"]): PaymentDTO {
  const id = randomUUID();
  return {
    id,
    companyId: users.novatek.id,
    freelancerId: users.priya.id,
    payerName: users.novatek.name,
    payeeName: users.priya.name,
    srcCurrency: "EUR",
    dstCurrency: "INR",
    srcAmountMinor: 50000,
    dstAmountMinor: 4500000,
    feeAmountMinor: 375,
    purposeCode: "P0802",
    invoiceRef: null,
    state,
    escrowId: "0x" + "ab".repeat(32),
    txHashFund: state === "FUNDED" || state === "COMPLETED" ? "0x" + "cd".repeat(32) : null,
    txHashRelease: state === "COMPLETED" ? "0x" + "ef".repeat(32) : null,
    timeline: [
      { state: "DRAFT", at: now() },
      { state: "COMPLIANCE_CHECK", at: now() },
    ],
    compliance: {
      id: randomUUID(),
      verdict: "APPROVE",
      ruleResults: [],
      agentExplanation:
        "This EUR 500 payment from a German company to a verified Indian freelancer for software services falls under FEMA purpose code P0802 and clears all checks.",
      anchorTxHash: "0x" + "12".repeat(32),
      reviewedBy: null,
      reviewNote: null,
      createdAt: now(),
    },
    createdAt: now(),
    updatedAt: now(),
  };
}

app.get("/health", async () => ({ ok: true, mock: true }));

app.post("/api/v1/auth/register", async () => ({ token: "mock.jwt.token", user: users.novatek }));
app.post("/api/v1/auth/login", async () => ({ token: "mock.jwt.token", user: users.novatek }));
app.get("/api/v1/auth/me", async () => users.novatek);
app.get("/api/v1/credentials/me", async () => ({
  id: randomUUID(),
  did: "did:gigbridge:mock",
  hash: "0x" + "aa".repeat(32),
  issuedAt: now(),
  expiresAt: now(),
  revoked: false,
}));

app.get("/api/v1/fx/quote", async (req): Promise<FxQuoteDTO> => {
  const q = req.query as { pair?: Corridor; amount?: string };
  const amount = Number(q.amount ?? 50000);
  return {
    quoteId: randomUUID(),
    pair: (q.pair ?? "EURINR") as Corridor,
    midRate: 90.25,
    srcAmountMinor: amount,
    fee: Math.max(Math.round(amount * 0.0075), 100),
    gasEstimate: 5,
    payeeReceives: Math.round(amount * 90.25),
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  };
});
app.get("/api/v1/fx/history", async (req) => {
  const q = req.query as { pair?: Corridor };
  const points = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10),
    rate: +(90 + Math.sin(i / 4)).toFixed(4),
  }));
  return { pair: q.pair ?? "EURINR", points };
});

app.post("/api/v1/payments", async () => ({ payment: fakePayment("COMPLIANCE_CHECK"), quote: null }));
app.post("/api/v1/payments/:id/confirm", async () => fakePayment("COMPLETED"));
app.post("/api/v1/payments/:id/release", async () => fakePayment("COMPLETED"));
app.post("/api/v1/payments/:id/refund", async () => fakePayment("REFUNDED"));
app.get("/api/v1/payments", async () => [fakePayment("COMPLETED"), fakePayment("FLAGGED")]);
app.get("/api/v1/payments/:id", async () => fakePayment("COMPLETED"));
app.get("/api/v1/payments/:id/timeline", async () => fakePayment("COMPLETED").timeline);

app.post("/api/v1/invoices", async () => ({ id: randomUUID(), status: "OPEN" }));
app.post("/api/v1/invoices/:id/approve", async () => ({ invoiceId: randomUUID(), draft: {} }));
app.get("/api/v1/invoices", async () => []);

app.get("/api/v1/admin/queue", async () => [fakePayment("FLAGGED")]);
app.post("/api/v1/admin/queue/:id/resolve", async () => fakePayment("RATE_LOCKED"));
app.get("/api/v1/admin/alerts", async () => [
  {
    id: randomUUID(),
    type: "STRUCTURING",
    paymentId: randomUUID(),
    severity: "FLAG",
    details: { message: "3 payments of EUR 9,400 within 72h" },
    resolved: false,
    createdAt: now(),
  },
]);
app.get("/api/v1/admin/metrics", async (): Promise<AdminMetricsDTO> => ({
  totalVolumeUsdMinor: 4_820_000,
  feeRevenueUsdMinor: 36_150,
  paymentsCompleted: 40,
  paymentsFlagged: 1,
  avgSettlementSeconds: 12,
  byCorridor: [
    { pair: "EURINR", count: 22, volumeUsdMinor: 2_600_000 },
    { pair: "USDINR", count: 18, volumeUsdMinor: 2_220_000 },
  ],
}));
app.get("/api/v1/admin/rules", async () => ({ rules: [], grouped: {} }));

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: "0.0.0.0" });
app.log.info(`GigBridge MOCK API on http://localhost:${port} (no DB)`);
