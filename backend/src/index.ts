// Real backend entrypoint.
import { buildApp } from './app.js';
import { env } from './lib/env.js';
import { enableRealSettlement } from './modules/settlement/real-settlement.js';
import { runDueSchedules } from './modules/schedules/schedule.service.js';

const app = await buildApp();
// P1 seam: activate on-chain settlement when SETTLEMENT_MODE=real, else no-op
// (simulated stays default). Never blocks boot — falls back on any chain error.
await enableRealSettlement(app.log);

// Recurring-payout runner (opt-in). Fires due schedules on a fixed tick; each run
// is best-effort and self-advancing so a failure never wedges the loop.
if (env.SCHEDULES_ENABLED) {
  const ms = Math.max(env.SCHEDULES_TICK_SECONDS, 5) * 1000;
  setInterval(() => {
    runDueSchedules().catch((err) => app.log.error({ err }, 'schedule runner tick failed'));
  }, ms).unref();
  app.log.info(`Recurring-payout runner on (every ${env.SCHEDULES_TICK_SECONDS}s)`);
}
app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then(() => app.log.info(`GigBridge backend on :${env.PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
