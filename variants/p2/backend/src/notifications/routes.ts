import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/db.js";
import { requireAuth, currentUser } from "../auth/rbac.js";

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  // GET /notifications
  app.get("/notifications", { preHandler: requireAuth }, async (req) => {
    const me = currentUser(req);
    return prisma.notification.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  });

  // POST /notifications/:id/read
  app.post("/notifications/:id/read", { preHandler: requireAuth }, async (req) => {
    const me = currentUser(req);
    const { id } = req.params as { id: string };
    await prisma.notification.updateMany({ where: { id, userId: me.id }, data: { read: true } });
    return { ok: true };
  });
}
