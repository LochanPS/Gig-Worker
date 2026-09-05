// System route. Public to any signed-in user, because every dashboard needs to
// label its transaction hashes honestly — not just the admin.
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/auth.routes.js';
import { getSystemInfo } from './system.service.js';

export async function systemRoutes(app: FastifyInstance) {
  app.get('/system/info', { preHandler: [requireAuth] }, async () => getSystemInfo());
}
