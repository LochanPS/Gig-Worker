# GigBridge frontend image. Build context is the REPO ROOT (the SPA imports the
# shared workspace package):
#   docker build -f frontend/Dockerfile .
# Vite builds a static bundle; `vite preview` serves it. VITE_API_BASE is baked in
# at build time — leave it empty to use same-origin /api (compose proxies it).
# syntax=docker/dockerfile:1
FROM node:20-slim AS build
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY contracts/package.json ./contracts/
COPY frontend/package.json ./frontend/
RUN pnpm install --frozen-lockfile
COPY shared ./shared
COPY frontend ./frontend
ARG VITE_API_BASE=""
ENV VITE_API_BASE=$VITE_API_BASE
RUN pnpm --filter @gigbridge/shared build && pnpm --filter ./frontend build

FROM build AS runtime
WORKDIR /app/frontend
EXPOSE 5173
CMD ["pnpm", "exec", "vite", "preview", "--host", "0.0.0.0", "--port", "5173"]
