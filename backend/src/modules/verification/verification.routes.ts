// Verification routes (FR-1). Self-serve KYC/KYB behind auth.
import type { FastifyInstance } from 'fastify';
import { kycSubmitSchema, kybSubmitSchema } from '@gigbridge/shared';
import { requireAuth, requireRole } from '../auth/auth.routes.js';
import { submitKyc, submitKyb, getVerificationStatus } from './verification.service.js';

export async function verificationRoutes(app: FastifyInstance) {
  app.get('/verification/me', { preHandler: [requireAuth] }, async (req) => getVerificationStatus(req.user.sub));

  app.post('/verification/kyc', { preHandler: [requireRole('FREELANCER')] }, async (req) => {
    const input = kycSubmitSchema.parse(req.body);
    return submitKyc(req.user.sub, input);
  });

  app.post('/verification/kyb', { preHandler: [requireRole('COMPANY')] }, async (req) => {
    const input = kybSubmitSchema.parse(req.body);
    return submitKyb(req.user.sub, input);
  });
}
