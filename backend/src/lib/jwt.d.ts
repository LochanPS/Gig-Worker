import '@fastify/jwt';
import type { Role } from '@gigbridge/shared';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; role: Role; email: string };
    user: { sub: string; role: Role; email: string };
  }
}
