// Real backend entrypoint.
import { buildApp } from './app.js';
import { env } from './lib/env.js';

const app = await buildApp();
app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then(() => app.log.info(`GigBridge backend on :${env.PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
