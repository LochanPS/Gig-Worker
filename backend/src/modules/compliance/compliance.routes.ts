// Admin compliance routes (BUILD_CONTRACTS §4): flag queue, resolve, rule registry.
import type { FastifyInstance } from 'fastify';
import { resolveQueueSchema } from '@gigbridge/shared';
import { requireRole } from '../auth/auth.routes.js';
import { prisma } from '../../lib/db.js';
import { RULES } from './rules/index.js';
import { adminResolveFlag } from '../payments/payment.service.js';
import { listAlerts, resolveAlert } from '../alerts/alert.service.js';

export async function complianceRoutes(app: FastifyInstance) {
  // Flagged payments awaiting review, with their decision + rule hits.
  app.get('/admin/queue', { preHandler: [requireRole('ADMIN')] }, async () => {
    const rows = await prisma.payment.findMany({
      where: { state: 'FLAGGED' },
      orderBy: { createdAt: 'desc' },
      include: { decision: true, company: true, freelancer: true },
    });
    return rows.map((p) => ({
      paymentId: p.id,
      company: p.company.name,
      freelancer: p.freelancer.name,
      srcCurrency: p.srcCurrency,
      dstCurrency: p.dstCurrency,
      srcAmountMinor: p.srcAmountMinor,
      verdict: p.decision?.verdict,
      ruleResults: p.decision?.ruleResults,
      agentExplanation: p.decision?.agentExplanation,
      createdAt: p.createdAt.toISOString(),
    }));
  });

  app.post('/admin/queue/:id/resolve', { preHandler: [requireRole('ADMIN')] }, async (req) => {
    const { action, note } = resolveQueueSchema.parse(req.body);
    return adminResolveFlag((req.params as { id: string }).id, action, note, req.user.sub);
  });

  // Read-only rule registry grouped for the admin dashboard.
  app.get('/admin/rules', { preHandler: [requireRole('ADMIN')] }, async () =>
    RULES.map((r) => ({ id: r.id, jurisdiction: r.jurisdiction, severity: r.severity, legalRef: r.legalRef })),
  );

  // Fraud/anomaly alerts.
  app.get('/admin/alerts', { preHandler: [requireRole('ADMIN')] }, async (req) => {
    const includeResolved = (req.query as { all?: string }).all === 'true';
    return listAlerts(includeResolved);
  });

  app.post('/admin/alerts/:id/resolve', { preHandler: [requireRole('ADMIN')] }, async (req) =>
    resolveAlert((req.params as { id: string }).id, req.user.sub),
  );
}
