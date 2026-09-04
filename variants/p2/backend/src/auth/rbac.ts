import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@gigbridge/shared";
import { ApiError } from "../lib/errors.js";

// JWT payload shape.
export interface AuthUser {
  id: string;
  role: Role;
  email: string;
}

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

/** Verifies the bearer JWT and attaches req.authUser. */
export async function requireAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    const payload = await req.jwtVerify<AuthUser>();
    req.authUser = { id: payload.id, role: payload.role, email: payload.email };
  } catch {
    throw ApiError.unauthorized();
  }
}

/** Role guard factory; chain after requireAuth in preHandler. */
export function requireRole(...roles: Role[]) {
  return async function (req: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!req.authUser) throw ApiError.unauthorized();
    if (!roles.includes(req.authUser.role)) {
      throw ApiError.forbidden(`Requires role: ${roles.join(" or ")}`);
    }
  };
}

export function currentUser(req: FastifyRequest): AuthUser {
  if (!req.authUser) throw ApiError.unauthorized();
  return req.authUser;
}
