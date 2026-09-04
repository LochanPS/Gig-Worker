// Payment routes (BUILD_CONTRACTS §4) + the authenticated websocket endpoint.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Role } from '@gigbridge/shared';
import { createPaymentSchema, confirmPaymentSchema, fxQuoteQuerySchema } from '@gigbridge/shared';
import { requireAuth, requireRole } from '../auth/auth.routes.js';
import { addConn } from '../../lib/ws.js';
import { createQuote, rateHistory } from '../fx/fx.service.js';
import { createPayment, confirmPayment, retryPayout, releasePayment, refundPayment, getPayment, listPayments, type Actor } from './payment.service.js';

// The signed-in caller, in the shape the orchestrator's guards expect.
const actorOf = (req: FastifyRequest): Actor => ({ id: req.user.sub, role: req.user.role as Role });

export async function paymentRoutes(app: FastifyInstance) {
  // FX quote (needed by the payout wizard before creating a payment).
  app.get('/fx/quote', { preHandler: [requireAuth] }, async (req) => {
    const { pair, amount } = fxQuoteQuerySchema.parse(req.query);
    return createQuote(pair, amount);
  });

  app.get('/fx/history', { preHandler: [requireAuth] }, async (req) => {
    const q = req.query as { pair?: string; days?: string };
    return rateHistory(q.pair ?? 'EURINR', Math.min(Number(q.days ?? 30), 90));
  });

  app.post('/payments', { preHandler: [requireRole('COMPANY')] }, async (req) => {
    const input = createPaymentSchema.parse(req.body);
    const { sub } = req.user;
    return createPayment(sub, input);
  });

  app.post('/payments/:id/confirm', { preHandler: [requireRole('COMPANY')] }, async (req) => {
    const { quoteId } = confirmPaymentSchema.parse(req.body);
    return confirmPayment((req.params as { id: string }).id, actorOf(req), quoteId);
  });

  app.post('/payments/:id/retry', { preHandler: [requireRole('COMPANY')] }, async (req) => {
    const { quoteId } = confirmPaymentSchema.parse(req.body);
    return retryPayout((req.params as { id: string }).id, actorOf(req), quoteId);
  });

  app.post('/payments/:id/release', { preHandler: [requireRole('COMPANY', 'ADMIN')] }, async (req) =>
    releasePayment((req.params as { id: string }).id, actorOf(req)),
  );

  app.post('/payments/:id/refund', { preHandler: [requireRole('COMPANY', 'ADMIN')] }, async (req) =>
    refundPayment((req.params as { id: string }).id, actorOf(req)),
  );

  app.get('/payments', { preHandler: [requireAuth] }, async (req) => listPayments(req.user.sub, req.user.role));

  app.get('/payments/:id', { preHandler: [requireAuth] }, async (req) =>
    getPayment((req.params as { id: string }).id, actorOf(req)),
  );

  app.get('/payments/:id/timeline', { preHandler: [requireAuth] }, async (req) => {
    const p = await getPayment((req.params as { id: string }).id, actorOf(req));
    return p.timeline;
  });

  // Authenticated websocket: /api/v1/ws?token=<jwt>
  app.get('/ws', { websocket: true }, (conn, req) => {
    const token = (req.query as { token?: string }).token;
    try {
      const decoded = app.jwt.verify<{ sub: string; role: string }>(token ?? '');
      addConn({ socket: conn.socket, userId: decoded.sub, role: decoded.role });
    } catch {
      conn.socket.close();
    }
  });
}
