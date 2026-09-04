# Corridor backend — Railway image. pnpm monorepo, build context = repo root.
#   Railway: New Service → Deploy from repo → set Dockerfile path to
#   deploy/backend.Dockerfile (railway.json already points here).
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH="/pnpm:$PATH"
RUN corepack enable
# openssl is needed by Prisma's query engine at runtime.
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- install (only the manifests first, for layer caching) ---
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY contracts/package.json contracts/
RUN pnpm install --frozen-lockfile || pnpm install

# --- source ---
COPY shared ./shared
COPY contracts ./contracts
COPY backend ./backend

# Build the shared contract package + generate the Prisma client.
RUN pnpm --filter @gigbridge/shared build \
 && pnpm --filter @gigbridge/backend exec prisma generate

ENV NODE_ENV=production
# SETTLEMENT_MODE unset => simulated settlement (no chain needed to boot).
EXPOSE 4000
# `start` runs `prisma migrate deploy` then boots the API (see backend/package.json).
CMD ["pnpm","--filter","@gigbridge/backend","start"]
