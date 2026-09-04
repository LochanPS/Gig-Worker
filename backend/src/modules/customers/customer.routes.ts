// Customer routes. Admin manages all; a company lists payable freelancers.
import type { FastifyInstance } from 'fastify';
import { createCustomerSchema, type Role } from '@gigbridge/shared';
import { requireAuth, requireRole } from '../auth/auth.routes.js';
import { listCustomers, getCustomer, createCustomer } from './customer.service.js';

export async function customerRoutes(app: FastifyInstance) {
  app.get('/customers', { preHandler: [requireAuth] }, async (req) => {
    const roleFilter = (req.query as { role?: Role }).role;
    return listCustomers({ id: req.user.sub, role: req.user.role }, roleFilter);
  });

  app.get('/customers/:id', { preHandler: [requireAuth] }, async (req) =>
    getCustomer((req.params as { id: string }).id),
  );

  // Company creates freelancers (payees); admin creates either.
  app.post('/customers', { preHandler: [requireRole('COMPANY', 'ADMIN')] }, async (req) => {
    const input = createCustomerSchema.parse(req.body);
    return createCustomer({ id: req.user.sub, role: req.user.role }, input);
  });
}
