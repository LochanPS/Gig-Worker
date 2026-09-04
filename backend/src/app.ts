import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import { ZodError } from "zod";
import { config } from "./lib/config.js";
import { ApiError } from "./lib/errors.js";
import { authRoutes } from "./auth/routes.js";
import { identityRoutes } from "./identity/routes.js";
import { fxRoutes } from "./fx/routes.js";
import { paymentRoutes } from "./payments/routes.js";
import { invoiceRoutes } from "./invoices/routes.js";
import { adminRoutes } from "./admin/routes.js";
import { documentRoutes } from "./documents/routes.js";
import { notificationRoutes } from "./notifications/routes.js";
import { wsRoutes } from "./ws/routes.js";
import { startMetricsTicker } from "./admin/ticker.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: config.jwtSecret, sign: { expiresIn: "12h" } });
  await app.register(websocket);

  // Uniform error envelope: {error:{code,message}} with proper HTTP status.
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) {
      return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message } });
    }
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: { code: "VALIDATION", message: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
      });
    }
    app.log.error(err);
    const e = err as { statusCode?: number; message?: string };
    const status = e.statusCode ?? 500;
    return reply.code(status).send({
      error: { code: "INTERNAL", message: status === 500 ? "Internal server error" : e.message ?? "Error" },
    });
  });

  app.get("/health", async () => ({ ok: true, ts: new Date().toISOString() }));

  // REST under /api/v1
  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(identityRoutes);
      await api.register(fxRoutes);
      await api.register(paymentRoutes);
      await api.register(invoiceRoutes);
      await api.register(adminRoutes);
      await api.register(documentRoutes);
      await api.register(notificationRoutes);
    },
    { prefix: "/api/v1" },
  );

  // WebSocket at /ws
  await app.register(wsRoutes);

  startMetricsTicker();
  return app;
}
