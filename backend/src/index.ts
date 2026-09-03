// Real backend entrypoint.
import { buildApp } from './app.js';
import { env } from './lib/env.js';
import { enableRealSettlement } from './modules/settlement/real-settlement.js';

const app = await buildApp();
// P1 seam: activate on-chain settlement when SETTLEMENT_MODE=real, else no-op
// (simulated stays default). Never blocks boot — falls back on any chain error.
await enableRealSettlement(app.log);
app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then(() => app.log.info(`GigBridge backend on :${env.PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
