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

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: env.NODE_ENV === 'test' ? 'silent' : 'info' } });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: env.JWT_SECRET });
  await app.register(websocket);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: err.errors[0]?.message ?? 'Invalid input', issues: err.errors } });
    }
    reply.log.error(err);
    return reply.code(err.statusCode ?? 500).send({ error: { code: 'INTERNAL', message: err.message } });
  });

  app.get('/health', async () => ({ ok: true }));

  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(paymentRoutes);
      // TODO(P2): compliance/admin, invoices, credentials
    },
    { prefix: '/api/v1' },
  );

  return app;
}
