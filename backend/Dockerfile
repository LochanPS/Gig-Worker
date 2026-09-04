# GigBridge backend image. Build context is the REPO ROOT, because the backend
# depends on the workspace packages:
#   docker build -f backend/Dockerfile .
#
# The backend runs its TypeScript through tsx (matching `pnpm dev`), so there is
# no compile step — what runs in the container is what runs locally. shared and
# contracts come along so real-settlement's deploy-on-boot and the on-chain event
# listener work in-container.
# syntax=docker/dockerfile:1
FROM node:20-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS deps
# Workspace manifests first, so a source-only change does not reinstall.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY contracts/package.json ./contracts/
COPY frontend/package.json ./frontend/
RUN pnpm install --frozen-lockfile

FROM deps AS runtime
COPY shared ./shared
COPY contracts ./contracts
COPY backend ./backend
RUN pnpm --filter @gigbridge/shared build \
 && pnpm --filter ./backend prisma:generate
ENV NODE_ENV=production
EXPOSE 4000
# Compose overrides this to migrate + seed first; this is the plain serve path.
CMD ["pnpm", "--filter", "./backend", "exec", "tsx", "src/index.ts"]
