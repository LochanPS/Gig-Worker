import type { FastifyInstance } from "fastify";
import { registerSchema, loginSchema } from "@gigbridge/shared";
import { prisma } from "../lib/db.js";
import { ApiError } from "../lib/errors.js";
import { audit } from "../lib/audit.js";
import { hashPassword, verifyPassword } from "./password.js";
import { requireAuth } from "./rbac.js";
import { toUserDTO } from "./mappers.js";
import { generateDemoWallet } from "../settlement/wallets.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /auth/register
  app.post("/auth/register", async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw ApiError.conflict("Email already registered", "EMAIL_TAKEN");

    const passwordHash = await hashPassword(body.password);
    // Demo wallets are generated server-side at signup (BUILD_CONTRACTS §2).
    const wallet = generateDemoWallet();

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        role: body.role,
        country: body.country.toUpperCase(),
        name: body.name,
        walletAddress: wallet.address,
        ...(body.role === "COMPANY"
          ? {
              companyProfile: {
                create: {
                  legalName: body.name,
                  regNumber: "",
                  country: body.country.toUpperCase(),
                  demoWalletKey: wallet.privateKey,
                },
              },
            }
          : {}),
        ...(body.role === "FREELANCER"
          ? {
              freelancerProfile: {
                create: {
                  fullName: body.name,
                  country: body.country.toUpperCase(),
                  demoWalletKey: wallet.privateKey,
                },
              },
            }
          : {}),
      },
    });

    await audit({ actorId: user.id, action: "REGISTER", entity: "User", entityId: user.id });
    const token = await reply.jwtSign({ id: user.id, role: user.role, email: user.email });
    return reply.code(201).send({ token, user: toUserDTO(user) });
  });

  // POST /auth/login
  app.post("/auth/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
      throw ApiError.unauthorized("Invalid email or password", "BAD_CREDENTIALS");
    }
    const token = await reply.jwtSign({ id: user.id, role: user.role, email: user.email });
    return { token, user: toUserDTO(user) };
  });

  // GET /auth/me
  app.get("/auth/me", { preHandler: requireAuth }, async (req) => {
    const user = await prisma.user.findUnique({ where: { id: req.authUser!.id } });
    if (!user) throw ApiError.notFound("User not found");
    return toUserDTO(user);
  });
}
