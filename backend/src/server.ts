import Fastify from "fastify";
import { API_PREFIX, PAYMENT_STATES } from "@gigbridge/shared";

const app = Fastify({ logger: true });

app.get("/health", async () => ({
  status: "ok",
  service: "gigbridge-backend",
  apiPrefix: API_PREFIX,
  // proves the shared treaty is wired into the backend build
  paymentStates: PAYMENT_STATES,
}));

const port = Number(process.env.PORT ?? 3000);

app
  .listen({ port, host: "0.0.0.0" })
  .then((addr) => app.log.info(`gigbridge backend listening on ${addr}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
