# GigBridge backend image (pnpm monorepo). Build context is the REPO ROOT:
#   docker build -f backend/Dockerfile .
# Bundles the workspace packages the backend needs (shared, contracts) so
# real-settlement deploy-on-boot and the on-chain event listener work in-container.
# syntax=docker/dockerfile:1
FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS build
# Workspace manifests first for better layer caching.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY shared ./shared
COPY contracts ./contracts
COPY backend ./backend
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @gigbridge/shared build \
 && pnpm --filter @gigbridge/backend db:generate \
 && pnpm --filter @gigbridge/backend build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app
EXPOSE 4000
# Compose overrides this with migrate + seed + start; kept as a sane default.
CMD ["node", "backend/dist/index.js"]
