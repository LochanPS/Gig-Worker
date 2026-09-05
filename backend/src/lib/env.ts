// Centralised, validated environment access.
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://gigbridge:gigbridge@localhost:5432/gigbridge'),
  JWT_SECRET: z.string().default('dev-only-change-me'),
  RPC_URL: z.string().default('http://localhost:8545'),
  CHAIN_ID: z.coerce.number().default(31337),
  PLATFORM_PRIVATE_KEY: z.string().optional(),
  DEPLOYER_PRIVATE_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5'),
  FX_API_URL: z.string().default('https://api.frankfurter.app'),
  FX_OFFLINE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  FEE_BPS: z.coerce.number().default(75),
  FEE_MIN_USD: z.coerce.number().default(1),
  RATE_LOCK_MINUTES: z.coerce.number().default(10),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.string().default('development'),
  // Recurring-payout runner. Off by default (behaviour unchanged); when true a
  // background tick fires due schedules every SCHEDULES_TICK_SECONDS. The manual
  // POST /schedules/run-due endpoint works regardless.
  SCHEDULES_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  SCHEDULES_TICK_SECONDS: z.coerce.number().default(60),
  // Operator heartbeat: how often metrics.tick goes out to connected admins
  // (BUILD_CONTRACTS §5 says every 5s) and how often stale rate locks are swept.
  METRICS_TICK_SECONDS: z.coerce.number().default(5),
  RATE_LOCK_SWEEP_SECONDS: z.coerce.number().default(60),
  // Real settlement is normally best-effort: if the chain is unreachable the backend
  // still boots on simulated settlement so a demo never dies on a network blip. That
  // is dangerous when you MEANT to be on-chain, because simulated returns
  // random-looking tx hashes that are indistinguishable from real ones. Set this to
  // refuse to boot instead, so "real" can never silently mean "fake".
  SETTLEMENT_STRICT: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  // AI adjudication of FLAGGED payments. On by default: the agent auto-clears or
  // auto-rejects confident cases and escalates only the rest to the human queue.
  // Set false to send every flag straight to a human.
  AI_ADJUDICATION: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),
});

export const env = envSchema.parse(process.env);
export const hasLlm = env.ANTHROPIC_API_KEY.length > 0;
