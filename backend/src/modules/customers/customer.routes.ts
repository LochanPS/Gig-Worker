// Customer routes. Admin manages all; a company lists payable freelancers.
import type { FastifyInstance } from 'fastify';
import { createCustomerSchema, updateWalletSchema, type Role } from '@gigbridge/shared';
import { requireAuth, requireRole } from '../auth/auth.routes.js';
import { listCustomers, getCustomer, createCustomer, updateCustomerWallet } from './customer.service.js';

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

  // Repoint a party at a different settlement wallet. Creation was the only path
  // that ever set one, so swapping a generated demo wallet for a funded account
  // previously meant re-seeding the database. Authorisation is enforced in the
  // service (admin: anyone; anyone: themselves; company: its payees).
  app.post('/customers/:id/wallet', { preHandler: [requireAuth] }, async (req) => {
    const input = updateWalletSchema.parse(req.body);
    return updateCustomerWallet(
      { id: req.user.sub, role: req.user.role },
      (req.params as { id: string }).id,
      input,
    );
  });
}
