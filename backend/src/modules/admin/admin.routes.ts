// Operator routes: platform metrics and the rate-lock sweeper trigger.
import type { FastifyInstance } from 'fastify';
import { requireRole } from '../auth/auth.routes.js';
import { computeMetrics } from './metrics.service.js';
import { adjudicationSummary } from './adjudication.service.js';
import { computeTreasury } from './treasury.service.js';
import { expireStaleRateLocks } from '../payments/payment.service.js';

export async function adminRoutes(app: FastifyInstance) {
  app.get('/admin/metrics', { preHandler: [requireRole('ADMIN')] }, async () => computeMetrics());

  // How much of the compliance queue the AI adjudicator settled without a human
  // (CORRIDOR_ROADMAP item 2), plus the most recent calls and their rationale.
  app.get('/admin/adjudications', { preHandler: [requireRole('ADMIN')] }, async () => adjudicationSummary());

  // Escrow currently held per corridor + fee revenue (UI_SPEC 5.4).
  app.get('/admin/treasury', { preHandler: [requireRole('ADMIN')] }, async () => computeTreasury());

  // Expire rate locks that have run past their validity window, now. The same
  // sweep runs on a timer in index.ts; this makes it demo- and test-triggerable.
  app.post('/admin/expire-locks', { preHandler: [requireRole('ADMIN')] }, async () => {
    const expired = await expireStaleRateLocks();
    return { expired: expired.length, paymentIds: expired };
  });
}
