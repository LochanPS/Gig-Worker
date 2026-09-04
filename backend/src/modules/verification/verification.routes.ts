// Verification routes (FR-1). Self-serve KYC/KYB behind auth.
import type { FastifyInstance } from 'fastify';
import { kycSubmitSchema, kybSubmitSchema } from '@gigbridge/shared';
import { requireAuth, requireRole } from '../auth/auth.routes.js';
import { submitKyc, submitKyb, getVerificationStatus, adminVerify } from './verification.service.js';

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

  // The frozen paths from BUILD_CONTRACTS §4. Same handlers — the contract was
  // written before the module settled on /verification/*, and consumers were
  // promised these. Keeping both means neither side has to move.
  app.post('/kyc/submit', { preHandler: [requireRole('FREELANCER')] }, async (req) => {
    const input = kycSubmitSchema.parse(req.body);
    return submitKyc(req.user.sub, input);
  });

  app.post('/kyb/submit', { preHandler: [requireRole('COMPANY')] }, async (req) => {
    const input = kybSubmitSchema.parse(req.body);
    return submitKyb(req.user.sub, input);
  });

  // Operator-issued verification: issues the credential + on-chain hash, exactly
  // as the self-serve flow does.
  app.post('/admin/verify/:userId', { preHandler: [requireRole('ADMIN')] }, async (req) =>
    adminVerify((req.params as { userId: string }).userId, req.user.sub),
  );
}
