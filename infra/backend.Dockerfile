# Backend image for the GigBridge demo stack.
FROM node:20-alpine
RUN corepack enable
WORKDIR /app

# Workspace manifests first for cached installs
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
RUN pnpm install --frozen-lockfile || pnpm install

# Source
COPY shared shared
COPY backend backend
RUN pnpm --filter @gigbridge/shared build \
  && pnpm --filter @gigbridge/backend db:generate \
  && pnpm --filter @gigbridge/backend build

EXPOSE 4000
CMD ["pnpm", "--filter", "@gigbridge/backend", "start"]
