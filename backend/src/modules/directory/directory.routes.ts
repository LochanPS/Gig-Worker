// Directory routes. A company needs the roster to pick a payee; an admin needs it
// for the operator view. No PII beyond what a payer already sees on a payment.
import type { FastifyInstance } from 'fastify';
import { requireRole } from '../auth/auth.routes.js';
import { listFreelancers } from './directory.service.js';

export async function directoryRoutes(app: FastifyInstance) {
  app.get('/directory/freelancers', { preHandler: [requireRole('COMPANY', 'ADMIN')] }, async () => listFreelancers());
}
