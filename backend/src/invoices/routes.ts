import type { FastifyInstance } from "fastify";
import { createInvoiceSchema } from "@gigbridge/shared";
import { prisma } from "../lib/db.js";
import { ApiError } from "../lib/errors.js";
import { requireAuth, requireRole, currentUser } from "../auth/rbac.js";
import { notify } from "../notifications/service.js";
import { audit } from "../lib/audit.js";

export async function invoiceRoutes(app: FastifyInstance): Promise<void> {
  // POST /invoices  (freelancer raises an invoice to a company)
  app.post(
    "/invoices",
    { preHandler: [requireAuth, requireRole("FREELANCER")] },
    async (req, reply) => {
      const me = currentUser(req);
      const body = createInvoiceSchema.parse(req.body);
      const company = await prisma.user.findUnique({ where: { id: body.companyId } });
      if (!company || company.role !== "COMPANY") throw ApiError.badRequest("Invalid company");

      const invoice = await prisma.invoice.create({
        data: {
          freelancerId: me.id,
          companyId: body.companyId,
          amountMinor: body.amountMinor,
          currency: body.currency,
          memo: body.memo,
        },
      });
      await notify({
        userId: body.companyId,
        kind: "INVOICE",
        title: "New invoice",
        body: `${company.name ? "" : ""}Invoice for ${body.currency} received.`,
      });
      await audit({ actorId: me.id, action: "INVOICE_CREATE", entity: "Invoice", entityId: invoice.id });
      return reply.code(201).send(invoice);
    },
  );

  // POST /invoices/:id/approve  (company approves -> creates a payment draft)
  app.post(
    "/invoices/:id/approve",
    { preHandler: [requireAuth, requireRole("COMPANY")] },
    async (req) => {
      const me = currentUser(req);
      const { id } = req.params as { id: string };
      const invoice = await prisma.invoice.findUnique({ where: { id } });
      if (!invoice) throw ApiError.notFound("Invoice not found");
      if (invoice.companyId !== me.id) throw ApiError.forbidden();
      if (invoice.status !== "OPEN") throw ApiError.conflict("Invoice already handled");

      await prisma.invoice.update({ where: { id }, data: { status: "APPROVED" } });
      await audit({ actorId: me.id, action: "INVOICE_APPROVE", entity: "Invoice", entityId: id });

      // Returns the parameters the client uses to open the payment wizard.
      return {
        invoiceId: id,
        draft: {
          payeeId: invoice.freelancerId,
          srcCurrency: invoice.currency,
          srcAmountMinor: invoice.amountMinor,
          memo: invoice.memo,
        },
      };
    },
  );

  // GET /invoices  (role-scoped)
  app.get("/invoices", { preHandler: requireAuth }, async (req) => {
    const me = currentUser(req);
    const where =
      me.role === "COMPANY"
        ? { companyId: me.id }
        : me.role === "FREELANCER"
          ? { freelancerId: me.id }
          : {};
    return prisma.invoice.findMany({ where, orderBy: { createdAt: "desc" } });
  });
}
