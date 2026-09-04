import type { FastifyInstance } from "fastify";
import { kycSubmitSchema, kybSubmitSchema } from "@gigbridge/shared";
import { prisma } from "../lib/db.js";
import { ApiError } from "../lib/errors.js";
import { audit } from "../lib/audit.js";
import { requireAuth, requireRole, currentUser } from "../auth/rbac.js";
import { issueCredential, toCredentialDTO } from "./credentials.js";
import { notify } from "../notifications/service.js";

export async function identityRoutes(app: FastifyInstance): Promise<void> {
  // POST /kyc/submit  (freelancer)
  app.post(
    "/kyc/submit",
    { preHandler: [requireAuth, requireRole("FREELANCER")] },
    async (req) => {
      const me = currentUser(req);
      const body = kycSubmitSchema.parse(req.body);
      await prisma.freelancerProfile.update({
        where: { userId: me.id },
        data: {
          fullName: body.fullName,
          panOrTaxId: body.panOrTaxId,
          payoutPreference: body.payoutPreference,
          kycStatus: "PENDING",
        },
      });
      await audit({ actorId: me.id, action: "KYC_SUBMIT", entity: "FreelancerProfile", entityId: me.id });
      return { status: "PENDING" };
    },
  );

  // POST /kyb/submit  (company)
  app.post(
    "/kyb/submit",
    { preHandler: [requireAuth, requireRole("COMPANY")] },
    async (req) => {
      const me = currentUser(req);
      const body = kybSubmitSchema.parse(req.body);
      await prisma.companyProfile.update({
        where: { userId: me.id },
        data: {
          legalName: body.legalName,
          regNumber: body.regNumber,
          country: body.country.toUpperCase(),
          kybStatus: "PENDING",
        },
      });
      await audit({ actorId: me.id, action: "KYB_SUBMIT", entity: "CompanyProfile", entityId: me.id });
      return { status: "PENDING" };
    },
  );

  // GET /credentials/me
  app.get("/credentials/me", { preHandler: requireAuth }, async (req) => {
    const me = currentUser(req);
    const cred = await prisma.credential.findFirst({
      where: { userId: me.id },
      orderBy: { issuedAt: "desc" },
    });
    return cred ? toCredentialDTO(cred) : null;
  });

  // POST /admin/verify/:userId  -> issues VC + on-chain hash
  app.post(
    "/admin/verify/:userId",
    { preHandler: [requireAuth, requireRole("ADMIN")] },
    async (req) => {
      const me = currentUser(req);
      const { userId } = req.params as { userId: string };
      const target = await prisma.user.findUnique({ where: { id: userId } });
      if (!target) throw ApiError.notFound("User not found");
      if (target.role === "ADMIN") throw ApiError.badRequest("Admins are not verified");
      const cred = await issueCredential(userId, me.id);
      await notify({
        userId,
        kind: "IDENTITY",
        title: "Identity verified",
        body: "Your GigBridge credential has been issued. You can now transact.",
      });
      return cred;
    },
  );
}
