import type { FastifyInstance } from "fastify";
import { createPaymentSchema, confirmPaymentSchema } from "@gigbridge/shared";
import { prisma } from "../lib/db.js";
import { ApiError } from "../lib/errors.js";
import { requireAuth, requireRole, currentUser } from "../auth/rbac.js";
import { corridorOf } from "../lib/money.js";
import { createQuote } from "../fx/service.js";
import {
  createAndScreen,
  confirmAndSettle,
  refund,
  release,
  loadPayment,
} from "./orchestrator.js";
import { toPaymentDTO, paymentInclude } from "./mappers.js";

export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  // POST /payments  (company creates + screens; returns payment + a fresh quote)
  app.post(
    "/payments",
    { preHandler: [requireAuth, requireRole("COMPANY")] },
    async (req, reply) => {
      const me = currentUser(req);
      const body = createPaymentSchema.parse(req.body);

      const payee = await prisma.user.findUnique({
        where: { id: body.payeeId },
        include: { freelancerProfile: true },
      });
      if (!payee || payee.role !== "FREELANCER") throw ApiError.badRequest("Payee must be a freelancer");
      const company = await prisma.user.findUnique({ where: { id: me.id } });

      const p = await createAndScreen({
        companyId: me.id,
        input: {
          companyId: me.id,
          freelancerId: body.payeeId,
          payerName: company!.name,
          payeeName: payee.name,
          payerCountry: company!.country,
          payeeCountry: payee.country,
          srcCurrency: body.srcCurrency,
          dstCurrency: body.dstCurrency,
          srcAmountMinor: body.srcAmountMinor,
          purposeCode: body.purposeCode,
          freelancerHasPan: !!payee.freelancerProfile?.panOrTaxId,
          invoiceRef: body.invoiceRef,
        },
      });

      // Attach a quote the payer can confirm with (unless rejected).
      const dto = toPaymentDTO(p);
      const quote =
        p.state === "REJECTED"
          ? null
          : await createQuote(corridorOf(body.srcCurrency, body.dstCurrency), body.srcAmountMinor);
      return reply.code(201).send({ payment: dto, quote });
    },
  );

  // POST /payments/:id/confirm  {quoteId}
  app.post(
    "/payments/:id/confirm",
    { preHandler: [requireAuth, requireRole("COMPANY")] },
    async (req) => {
      const me = currentUser(req);
      const { id } = req.params as { id: string };
      const body = confirmPaymentSchema.parse(req.body);
      const existing = await loadPayment(id);
      if (existing.companyId !== me.id) throw ApiError.forbidden();
      const p = await confirmAndSettle(id, body.quoteId, me.id);
      return toPaymentDTO(p);
    },
  );

  // POST /payments/:id/release
  app.post(
    "/payments/:id/release",
    { preHandler: [requireAuth, requireRole("COMPANY", "ADMIN")] },
    async (req) => {
      const me = currentUser(req);
      const { id } = req.params as { id: string };
      const existing = await loadPayment(id);
      if (me.role === "COMPANY" && existing.companyId !== me.id) throw ApiError.forbidden();
      return toPaymentDTO(await release(id, me.id));
    },
  );

  // POST /payments/:id/refund
  app.post(
    "/payments/:id/refund",
    { preHandler: [requireAuth, requireRole("COMPANY", "ADMIN")] },
    async (req) => {
      const me = currentUser(req);
      const { id } = req.params as { id: string };
      const existing = await loadPayment(id);
      if (me.role === "COMPANY" && existing.companyId !== me.id) throw ApiError.forbidden();
      return toPaymentDTO(await refund(id, me.id));
    },
  );

  // GET /payments  (role-scoped list)
  app.get("/payments", { preHandler: requireAuth }, async (req) => {
    const me = currentUser(req);
    const where =
      me.role === "ADMIN"
        ? {}
        : me.role === "COMPANY"
          ? { companyId: me.id }
          : { freelancerId: me.id };
    const rows = await prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map(toPaymentDTO);
  });

  // GET /payments/:id  (includes timeline[] and compliance)
  app.get("/payments/:id", { preHandler: requireAuth }, async (req) => {
    const me = currentUser(req);
    const { id } = req.params as { id: string };
    const p = await loadPayment(id);
    if (me.role !== "ADMIN" && p.companyId !== me.id && p.freelancerId !== me.id) {
      throw ApiError.forbidden();
    }
    return toPaymentDTO(p);
  });

  // GET /payments/:id/timeline
  app.get("/payments/:id/timeline", { preHandler: requireAuth }, async (req) => {
    const me = currentUser(req);
    const { id } = req.params as { id: string };
    const p = await loadPayment(id);
    if (me.role !== "ADMIN" && p.companyId !== me.id && p.freelancerId !== me.id) {
      throw ApiError.forbidden();
    }
    return toPaymentDTO(p).timeline;
  });
}
