// Payment routes (BUILD_CONTRACTS §4) + the authenticated websocket endpoint.
import type { FastifyInstance } from 'fastify';
import { createPaymentSchema, confirmPaymentSchema, fxQuoteQuerySchema } from '@gigbridge/shared';
import { requireAuth, requireRole } from '../auth/auth.routes.js';
import { addConn } from '../../lib/ws.js';
import { createQuote } from '../fx/fx.service.js';
import { createPayment, confirmPayment, releasePayment, refundPayment, getPayment, listPayments } from './payment.service.js';

export async function paymentRoutes(app: FastifyInstance) {
  // FX quote (needed by the payout wizard before creating a payment).
  app.get('/fx/quote', { preHandler: [requireAuth] }, async (req) => {
    const { pair, amount } = fxQuoteQuerySchema.parse(req.query);
    return createQuote(pair, amount);
  });

  app.post('/payments', { preHandler: [requireRole('COMPANY')] }, async (req) => {
    const input = createPaymentSchema.parse(req.body);
    const { sub } = req.user;
    return createPayment(sub, input);
  });

  app.post('/payments/:id/confirm', { preHandler: [requireRole('COMPANY')] }, async (req) => {
    const { quoteId } = confirmPaymentSchema.parse(req.body);
    return confirmPayment((req.params as { id: string }).id, req.user.sub, quoteId);
  });

  app.post('/payments/:id/release', { preHandler: [requireRole('COMPANY', 'ADMIN')] }, async (req) =>
    releasePayment((req.params as { id: string }).id, req.user.sub),
  );

  app.post('/payments/:id/refund', { preHandler: [requireRole('COMPANY', 'ADMIN')] }, async (req) =>
    refundPayment((req.params as { id: string }).id, req.user.sub),
  );

  app.get('/payments', { preHandler: [requireAuth] }, async (req) => listPayments(req.user.sub, req.user.role));

  app.get('/payments/:id', { preHandler: [requireAuth] }, async (req) =>
    getPayment((req.params as { id: string }).id, req.user.sub),
  );

  app.get('/payments/:id/timeline', { preHandler: [requireAuth] }, async (req) => {
    const p = await getPayment((req.params as { id: string }).id, req.user.sub);
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
