// Batch pay-run routes (FR-2.5). Company-only.
import type { FastifyInstance } from 'fastify';
import { createPayRunSchema } from '@gigbridge/shared';
import { requireRole } from '../auth/auth.routes.js';
import { createPayRun, confirmPayRun, listPayRuns, getPayRun } from './payrun.service.js';

export async function payRunRoutes(app: FastifyInstance) {
  app.post('/payruns', { preHandler: [requireRole('COMPANY')] }, async (req) => {
    const input = createPayRunSchema.parse(req.body);
    return createPayRun(req.user.sub, input);
  });

  app.post('/payruns/:id/confirm', { preHandler: [requireRole('COMPANY')] }, async (req) =>
    confirmPayRun((req.params as { id: string }).id, req.user.sub),
  );

  app.get('/payruns', { preHandler: [requireRole('COMPANY')] }, async (req) => listPayRuns(req.user.sub));

  app.get('/payruns/:id', { preHandler: [requireRole('COMPANY')] }, async (req) =>
    getPayRun((req.params as { id: string }).id, req.user.sub),
  );
}
