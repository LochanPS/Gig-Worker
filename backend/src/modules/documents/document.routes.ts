// Document routes (BUILD_CONTRACTS §4). Serve print-ready HTML the browser can
// save as PDF. Auth required; the frontend can open in a new tab or trigger print.
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/db.js';
import { requireAuth } from '../auth/auth.routes.js';
import { receiptHtml, complianceReportHtml, fircHtml, paymentDocuments } from './document.service.js';

export async function documentRoutes(app: FastifyInstance) {
  // Descriptor: which documents exist for this payment and whether each is ready.
  // The UI renders its document controls straight from this (single source of truth).
  app.get('/payments/:id/documents', { preHandler: [requireAuth] }, async (req) => {
    const id = (req.params as { id: string }).id;
    const p = await prisma.payment.findUniqueOrThrow({
      where: { id },
      select: { id: true, state: true, dstCurrency: true, decision: { select: { id: true } } },
    });
    return paymentDocuments({ id: p.id, state: p.state, dstCurrency: p.dstCurrency, hasDecision: !!p.decision });
  });

  app.get('/payments/:id/receipt.pdf', { preHandler: [requireAuth] }, async (req, reply) => {
    const html = await receiptHtml((req.params as { id: string }).id);
    return reply.type('text/html; charset=utf-8').send(html);
  });

  app.get('/payments/:id/compliance.pdf', { preHandler: [requireAuth] }, async (req, reply) => {
    const html = await complianceReportHtml((req.params as { id: string }).id);
    return reply.type('text/html; charset=utf-8').send(html);
  });

  // FIRC — Foreign Inward Remittance Certificate. Only for a COMPLETED, INR-credited
  // remittance; the service guards those and the global error handler maps statusCode.
  app.get('/payments/:id/firc.pdf', { preHandler: [requireAuth] }, async (req, reply) => {
    const html = await fircHtml((req.params as { id: string }).id);
    return reply.type('text/html; charset=utf-8').send(html);
  });
}
