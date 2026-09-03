// Document routes (BUILD_CONTRACTS §4). Serve print-ready HTML the browser can
// save as PDF. Auth required; the frontend can open in a new tab or trigger print.
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/auth.routes.js';
import { receiptHtml, complianceReportHtml } from './document.service.js';

export async function documentRoutes(app: FastifyInstance) {
  app.get('/payments/:id/receipt.pdf', { preHandler: [requireAuth] }, async (req, reply) => {
    const html = await receiptHtml((req.params as { id: string }).id);
    return reply.type('text/html; charset=utf-8').send(html);
  });

  app.get('/payments/:id/compliance.pdf', { preHandler: [requireAuth] }, async (req, reply) => {
    const html = await complianceReportHtml((req.params as { id: string }).id);
    return reply.type('text/html; charset=utf-8').send(html);
  });
}
