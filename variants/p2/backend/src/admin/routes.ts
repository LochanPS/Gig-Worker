import type { FastifyInstance } from "fastify";
import { resolveQueueSchema } from "@gigbridge/shared";
import { prisma } from "../lib/db.js";
import { requireAuth, requireRole, currentUser } from "../auth/rbac.js";
import { toPaymentDTO, paymentInclude } from "../payments/mappers.js";
import { resolveFlag } from "../payments/orchestrator.js";
import { ruleRegistry } from "../compliance/rules.js";
import { computeMetrics } from "./metrics.js";
import type { AlertDTO, RuleSeverity } from "@gigbridge/shared";

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const guard = { preHandler: [requireAuth, requireRole("ADMIN")] };

  // GET /admin/queue  (flagged payments)
  app.get("/admin/queue", guard, async () => {
    const rows = await prisma.payment.findMany({
      where: { state: "FLAGGED" },
      include: paymentInclude,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toPaymentDTO);
  });

  // POST /admin/queue/:id/resolve  {action, note}
  app.post("/admin/queue/:id/resolve", guard, async (req) => {
    const me = currentUser(req);
    const { id } = req.params as { id: string };
    const body = resolveQueueSchema.parse(req.body);
    const p = await resolveFlag(id, body.action, body.note, me.id);
    return toPaymentDTO(p);
  });

  // GET /admin/alerts
  app.get("/admin/alerts", guard, async () => {
    const rows = await prisma.alert.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return rows.map(
      (a): AlertDTO => ({
        id: a.id,
        type: a.type,
        paymentId: a.paymentId,
        severity: a.severity as RuleSeverity,
        details: (a.detailsJson ?? {}) as Record<string, unknown>,
        resolved: a.resolved,
        createdAt: a.createdAt.toISOString(),
      }),
    );
  });

  // GET /admin/metrics
  app.get("/admin/metrics", guard, async () => computeMetrics());

  // GET /admin/rules  (read-only registry grouped by jurisdiction)
  app.get("/admin/rules", guard, async () => {
    const rules = ruleRegistry();
    const grouped: Record<string, typeof rules> = {};
    for (const r of rules) (grouped[r.jurisdiction] ??= []).push(r);
    return { rules, grouped };
  });
}
