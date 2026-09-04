// Invoice routes (BUILD_CONTRACTS §4).
import type { FastifyInstance } from 'fastify';
import { createInvoiceSchema } from '@gigbridge/shared';
import { requireAuth, requireRole } from '../auth/auth.routes.js';
import { createInvoice, approveInvoice, listInvoices } from './invoice.service.js';

export async function invoiceRoutes(app: FastifyInstance) {
  // Freelancer raises an invoice.
  app.post('/invoices', { preHandler: [requireRole('FREELANCER')] }, async (req) => {
    const input = createInvoiceSchema.parse(req.body);
    return createInvoice(req.user.sub, input);
  });

  // Company approves -> creates the payment.
  app.post('/invoices/:id/approve', { preHandler: [requireRole('COMPANY')] }, async (req) =>
    approveInvoice((req.params as { id: string }).id, req.user.sub),
  );

  // Both sides list their invoices (role-scoped).
  app.get('/invoices', { preHandler: [requireAuth] }, async (req) => listInvoices(req.user.sub, req.user.role));
}
