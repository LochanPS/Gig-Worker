// Auth: register / login / me + JWT + RBAC guards (BUILD_CONTRACTS §4).
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { registerSchema, loginSchema, type Role } from '@gigbridge/shared';
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';

interface JwtPayload {
  sub: string;
  role: Role;
  email: string;
}

function publicUser(u: {
  id: string;
  role: Role;
  email: string;
  country: string;
  name: string;
  walletAddress: string | null;
  createdAt: Date;
}) {
  return {
    id: u.id,
    role: u.role,
    email: u.email,
    country: u.country,
    name: u.name,
    walletAddress: u.walletAddress,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.code(409).send({ error: { code: 'EMAIL_TAKEN', message: 'Email already registered' } });
    }
    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        role: body.role,
        email: body.email,
        passwordHash,
        country: body.country,
        name: body.name,
        ...(body.role === 'COMPANY'
          ? {
              company: {
                create: {
                  legalName: body.legalName ?? body.name,
                  regNumber: body.regNumber ?? 'PENDING',
                  country: body.country,
                },
              },
            }
          : body.role === 'FREELANCER'
            ? {
                freelancer: {
                  create: {
                    fullName: body.name,
                    country: body.country,
                    panOrTaxId: body.panOrTaxId ?? null,
                  },
                },
              }
            : {}),
      },
    });
    await audit(user.id, 'REGISTER', `user:${user.id}`, null, { role: user.role });
    const token = app.jwt.sign({ sub: user.id, role: user.role, email: user.email } satisfies JwtPayload);
    return reply.send({ token, user: publicUser(user) });
  });

  app.post('/auth/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: { code: 'AUTH', message: 'Invalid credentials' } });
    }
    const token = app.jwt.sign({ sub: user.id, role: user.role, email: user.email } satisfies JwtPayload);
    return reply.send({ token, user: publicUser(user) });
  });

  app.get('/auth/me', { preHandler: [requireAuth] }, async (req, reply) => {
    const { sub } = req.user as JwtPayload;
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return reply.send(publicUser(user));
  });
}

// --- guards (reusable across modules) ---
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: { code: 'AUTH', message: 'Unauthorized' } });
  }
}

export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(req, reply);
    if (reply.sent) return;
    const { role } = req.user as JwtPayload;
    if (!roles.includes(role)) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient role' } });
    }
  };
}
