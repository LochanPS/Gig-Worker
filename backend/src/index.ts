// Real backend entrypoint.
import { buildApp } from './app.js';
import { env } from './lib/env.js';
import { enableRealSettlement } from './modules/settlement/real-settlement.js';
import { runDueSchedules } from './modules/schedules/schedule.service.js';
import { computeMetrics } from './modules/admin/metrics.service.js';
import { expireStaleRateLocks } from './modules/payments/payment.service.js';
import { emitToAdmins, hasAdmins } from './lib/ws.js';

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
// Operator heartbeat (BUILD_CONTRACTS §5): push metrics.tick to connected admins
// every 5s so the live monitor moves without polling. Skipped entirely when no
// admin is watching, so an idle server does no work.
setInterval(() => {
  if (!hasAdmins()) return;
  computeMetrics()
    .then((metrics) => emitToAdmins({ type: 'metrics.tick', metrics }))
    .catch((err) => app.log.error({ err }, 'metrics tick failed'));
}, env.METRICS_TICK_SECONDS * 1000).unref();

// Rate-lock sweeper: a lock past its window becomes EXPIRED rather than staying
// fundable at a rate the company never agreed to.
setInterval(() => {
  expireStaleRateLocks()
    .then((ids) => {
      if (ids.length) app.log.info(`Expired ${ids.length} stale rate lock(s)`);
    })
    .catch((err) => app.log.error({ err }, 'rate-lock sweep failed'));
}, env.RATE_LOCK_SWEEP_SECONDS * 1000).unref();

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then(() => app.log.info(`GigBridge backend on :${env.PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
