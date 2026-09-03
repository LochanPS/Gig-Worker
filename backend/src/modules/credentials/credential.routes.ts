// Credential routes. The identity card reads /credentials/me; the credential
// certificate document is owner-or-admin only (identity-sensitive — tighter than
// the payment documents).
import type { FastifyInstance } from 'fastify';
import type { Role } from '@gigbridge/shared';
import { prisma } from '../../lib/db.js';
import { requireAuth } from '../auth/auth.routes.js';
import { activeCredentialForUser, credentialHtml } from './credential.service.js';

type AuthUser = { sub: string; role: Role };

export async function credentialRoutes(app: FastifyInstance) {
  // The signed-in user's active credential (PII-safe). 404 when they have none.
  app.get('/credentials/me', { preHandler: [requireAuth] }, async (req, reply) => {
    const { sub } = req.user as AuthUser;
    const cred = await activeCredentialForUser(sub);
    if (!cred) {
      return reply.code(404).send({ error: { code: 'NO_CREDENTIAL', message: 'No active credential — identity not yet verified' } });
    }
    return reply.send(cred);
  });

  // Credential certificate document (print-ready HTML). Owner or admin only.
  app.get('/credentials/:id/credential.pdf', { preHandler: [requireAuth] }, async (req, reply) => {
    const { sub, role } = req.user as AuthUser;
    const id = (req.params as { id: string }).id;
    const cred = await prisma.credential.findUnique({ where: { id }, select: { userId: true } });
    if (!cred) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Credential not found' } });
    }
    if (cred.userId !== sub && role !== 'ADMIN') {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Not your credential' } });
    }
    const html = await credentialHtml(id);
    return reply.type('text/html; charset=utf-8').send(html);
  });
}
