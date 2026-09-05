// Fastify app factory — registers plugins and route modules.
// Modules land here as P2 build steps complete (auth -> payments -> fx -> admin...).
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { ZodError } from 'zod';
import { env } from './lib/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { paymentRoutes } from './modules/payments/payment.routes.js';
import { registerComplianceEngine } from './modules/compliance/engine.js';
import { complianceRoutes } from './modules/compliance/compliance.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { notificationRoutes } from './modules/notifications/notification.routes.js';
import { directoryRoutes } from './modules/directory/directory.routes.js';
import { invoiceRoutes } from './modules/invoices/invoice.routes.js';
import { documentRoutes } from './modules/documents/document.routes.js';
import { credentialRoutes } from './modules/credentials/credential.routes.js';
import { verificationRoutes } from './modules/verification/verification.routes.js';
import { payRunRoutes } from './modules/payrun/payrun.routes.js';
import { scheduleRoutes } from './modules/schedules/schedule.routes.js';
import { payoutAccountRoutes } from './modules/payouts/payout-account.routes.js';
import { disputeRoutes } from './modules/disputes/dispute.routes.js';
import { getSettlementStatus } from './modules/settlement/settlement.interface.js';
import { customerRoutes } from './modules/customers/customer.routes.js';

// HTTP status -> stable error code for the {error:{code,message}} contract
// (BUILD_CONTRACTS §4).
const ERROR_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'AUTH',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION',
  500: 'INTERNAL',
};

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: env.NODE_ENV === 'test' ? 'silent' : 'info' } });

  registerComplianceEngine();

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: env.JWT_SECRET });
  await app.register(websocket);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: err.errors[0]?.message ?? 'Invalid input', issues: err.errors } });
    }
    const status = err.statusCode ?? 500;
    // Only a genuine 5xx is an internal error. Deliberate 4xx errors thrown by the
    // modules (403 party checks, 409 illegal transitions, 404s) were all reported
    // as code INTERNAL, which told a client nothing about what went wrong.
    if (status >= 500) reply.log.error(err);
    return reply.code(status).send({ error: { code: ERROR_CODES[status] ?? (status >= 500 ? 'INTERNAL' : 'BAD_REQUEST'), message: err.message } });
  });

  app.get('/health', async () => ({ ok: true }));

  await app.register(
    async (api) => {
      // Is settlement ACTUALLY on-chain right now? SETTLEMENT_MODE=real is only a
      // request — the handshake can fail and fall back to simulated, whose tx hashes
      // are random bytes that look exactly like real ones. The UI reads this to label
      // the network and to stop linking fake hashes at a block explorer. Unauthed on
      // purpose: it exposes only the mode, chain id and public contract addresses.
      api.get('/meta', async () => getSettlementStatus());
      await api.register(authRoutes);
      await api.register(paymentRoutes);
      await api.register(complianceRoutes);
      await api.register(adminRoutes);
      await api.register(notificationRoutes);
      await api.register(directoryRoutes);
      await api.register(invoiceRoutes);
      await api.register(documentRoutes);
      await api.register(credentialRoutes);
      await api.register(verificationRoutes);
      await api.register(payRunRoutes);
      await api.register(scheduleRoutes);
      await api.register(payoutAccountRoutes);
      await api.register(disputeRoutes);
      await api.register(customerRoutes);
    },
    { prefix: '/api/v1' },
  );

  return app;
}
