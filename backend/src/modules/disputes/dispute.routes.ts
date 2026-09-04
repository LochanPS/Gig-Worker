// Dispute routes. Parties raise; admins resolve.
import type { FastifyInstance } from 'fastify';
import { raiseDisputeSchema, resolveDisputeSchema } from '@gigbridge/shared';
import { requireAuth, requireRole } from '../auth/auth.routes.js';
import { raiseDispute, resolveDispute, listDisputes } from './dispute.service.js';

export async function disputeRoutes(app: FastifyInstance) {
  app.get('/disputes', { preHandler: [requireAuth] }, async (req) => listDisputes(req.user.sub, req.user.role));

  app.post('/disputes', { preHandler: [requireAuth] }, async (req) => {
    const input = raiseDisputeSchema.parse(req.body);
    return raiseDispute(req.user.sub, req.user.role, input);
  });

  app.post('/disputes/:id/resolve', { preHandler: [requireRole('ADMIN')] }, async (req) => {
    const { action, note } = resolveDisputeSchema.parse(req.body);
    return resolveDispute((req.params as { id: string }).id, req.user.sub, action, note);
  });
}
