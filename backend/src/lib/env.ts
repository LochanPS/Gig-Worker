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
});

export const env = envSchema.parse(process.env);
export const hasLlm = env.ANTHROPIC_API_KEY.length > 0;
