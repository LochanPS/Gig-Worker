import type { FastifyInstance } from "fastify";
import { fxQuoteQuerySchema, fxHistoryQuerySchema } from "@gigbridge/shared";
import { requireAuth } from "../auth/rbac.js";
import { createQuote, getHistory } from "./service.js";

export async function fxRoutes(app: FastifyInstance): Promise<void> {
  // GET /fx/quote?pair=EURINR&amount=50000  (amount in minor units)
  app.get("/fx/quote", { preHandler: requireAuth }, async (req) => {
    const q = fxQuoteQuerySchema.parse(req.query);
    return createQuote(q.pair, q.amount);
  });

  // GET /fx/history?pair=EURINR&days=30
  app.get("/fx/history", { preHandler: requireAuth }, async (req) => {
    const q = fxHistoryQuerySchema.parse(req.query);
    return { pair: q.pair, points: await getHistory(q.pair, q.days) };
  });
}
