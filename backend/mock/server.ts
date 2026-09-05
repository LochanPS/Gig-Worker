// Mock API server (BUILD_CONTRACTS §4) — lets P3/frontend build before the real
// backend exists. In-memory, no DB, no chain. Not for production.
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { randomUUID } from 'node:crypto';
import type { Payment, WsEvent } from '@gigbridge/shared';
import { users, payments, makeQuote, alerts, decisions, metrics } from './fixtures.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(websocket);

const P = '/api/v1';
const token = (id: string) => `mock-jwt.${id}`;
const userList = Object.values(users);
const byToken = (t?: string) => userList.find((u) => token(u.id) === (t ?? '').replace('Bearer ', ''));
const strip = (u: (typeof userList)[number]) => { const { password: _password, ...rest } = u; return rest; };

// --- auth ---
app.post(`${P}/auth/register`, async (req, reply) => {
  const b = req.body as any;
  const u = { ...userList[0], id: randomUUID(), email: b.email, role: b.role, country: b.country, name: b.name, password: b.password };
  return reply.send({ token: token(u.id), user: strip(u) });
});
app.post(`${P}/auth/login`, async (req, reply) => {
  const b = req.body as any;
  const u = userList.find((x) => x.email === b.email);
  if (!u) return reply.code(401).send({ error: { code: 'AUTH', message: 'invalid credentials' } });
  return reply.send({ token: token(u.id), user: strip(u) });
});
app.get(`${P}/auth/me`, async (req, reply) => {
  const u = byToken(req.headers.authorization);
  if (!u) return reply.code(401).send({ error: { code: 'AUTH', message: 'unauthorized' } });
  return reply.send(strip(u));
});

// --- fx ---
app.get(`${P}/fx/quote`, async (req) => {
  const q = req.query as any;
  return makeQuote(q.pair, Number(q.amount));
});
app.get(`${P}/fx/history`, async (req) => {
  const q = req.query as any;
  const days = Number(q.days ?? 30);
  const base = q.pair === 'USDINR' ? 83 : 90;
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - i) * 86_400_000).toISOString().slice(0, 10),
    rate: +(base + Math.sin(i / 3) * 0.8).toFixed(3),
  }));
});

// --- payments ---
app.get(`${P}/payments`, async () => payments);
app.get(`${P}/payments/:id`, async (req, reply) => {
  const p = payments.find((x) => x.id === (req.params as any).id);
  return p ? p : reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'no payment' } });
});
app.post(`${P}/payments`, async (req, reply) => {
  const b = req.body as any;
  const p: Payment = {
    id: randomUUID(), companyId: byToken(req.headers.authorization)?.id ?? users.novatek.id,
    companyName: 'Novatek GmbH', freelancerId: b.payeeId, freelancerName: 'Priya Sharma',
    srcCurrency: b.srcCurrency, dstCurrency: b.dstCurrency,
    srcAmountMinor: b.srcAmountMinor, dstAmountMinor: null, feeAmountMinor: null, fxRateId: null,
    purposeCode: b.purposeCode, invoiceRef: b.invoiceRef ?? null, state: 'COMPLIANCE_CHECK',
    escrowId: null, escrowMode: b.escrowMode ?? 'INSTANT', complianceDecisionId: 'cd-1', txHashFund: null, txHashRelease: null,
    payoutMethod: null, payoutRailRef: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    timeline: payments[0].timeline.slice(0, 2),
  };
  payments.push(p);
  return reply.send(p);
});
app.post(`${P}/payments/:id/confirm`, async (req) => {
  const p = payments.find((x) => x.id === (req.params as any).id)!;
  p.state = 'COMPLETED'; p.timeline = payments[0].timeline;
  return p;
});
app.post(`${P}/payments/:id/release`, async (req) => payments.find((x) => x.id === (req.params as any).id));
app.post(`${P}/payments/:id/refund`, async (req) => payments.find((x) => x.id === (req.params as any).id));
app.get(`${P}/payments/:id/timeline`, async (req) => (payments.find((x) => x.id === (req.params as any).id)?.timeline ?? []));

// --- compliance / admin ---
app.get(`${P}/admin/queue`, async () => payments.filter((p) => p.state === 'FLAGGED'));
app.post(`${P}/admin/queue/:id/resolve`, async () => ({ ok: true }));
app.get(`${P}/admin/alerts`, async () => alerts);
app.get(`${P}/admin/metrics`, async () => metrics);
app.get(`${P}/admin/rules`, async () => decisions[0].ruleResults);
app.get(`${P}/credentials/me`, async () => ({ did: 'did:gigbridge:priya', hash: '0xhash', issuedAt: '2026-08-01T00:00:00Z', expiresAt: '2027-08-01T00:00:00Z', revoked: false }));

// --- invoices ---
app.post(`${P}/invoices`, async (req, reply) => reply.send({ id: randomUUID(), status: 'SENT', ...(req.body as any) }));
app.post(`${P}/invoices/:id/approve`, async () => ({ ok: true }));

// --- websocket: emit a demo payment.state tick every 4s ---
app.get('/ws', { websocket: true }, (conn) => {
  const iv = setInterval(() => {
    const ev: WsEvent = { type: 'metrics.tick', metrics };
    conn.socket.send(JSON.stringify(ev));
  }, 4000);
  conn.socket.on('close', () => clearInterval(iv));
});

app.listen({ port: 4000, host: '0.0.0.0' }).then(() => app.log.info('mock API on :4000'));
