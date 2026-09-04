// Payout method routes. Freelancer-owned (the payee's destination).
import type { FastifyInstance } from 'fastify';
import { addPayoutAccountSchema } from '@gigbridge/shared';
import { requireAuth, requireRole } from '../auth/auth.routes.js';
import { addPayoutAccount, listPayoutAccounts, deactivatePayoutAccount } from './payout-account.service.js';

export async function payoutAccountRoutes(app: FastifyInstance) {
  app.get('/payout-accounts', { preHandler: [requireAuth] }, async (req) => listPayoutAccounts(req.user.sub));

  app.post('/payout-accounts', { preHandler: [requireRole('FREELANCER')] }, async (req) => {
    const input = addPayoutAccountSchema.parse(req.body);
    return addPayoutAccount(req.user.sub, input);
  });

  app.post('/payout-accounts/:id/remove', { preHandler: [requireRole('FREELANCER')] }, async (req) =>
    deactivatePayoutAccount((req.params as { id: string }).id, req.user.sub),
  );
}
