# Deploy Corridor — Railway (backend) + Neon (Postgres) + Vercel (frontend)

Free tiers, ~15 minutes, no code changes. You provide accounts + secrets; the repo
is already wired for split hosting (`VITE_API_BASE`, `railway.json`,
`deploy/backend.Dockerfile`, `frontend/vercel.json`).

## 1. Database — Neon (free)
1. neon.tech → new project → copy the **connection string** (the pooled
   `postgresql://…?sslmode=require` URL). That's your `DATABASE_URL`.

## 2. Backend — Railway (free trial credit)
1. railway.app → **New Project → Deploy from GitHub repo** → pick `LochanPS/Gig-Worker`.
2. Railway reads `railway.json` and builds `deploy/backend.Dockerfile` automatically.
3. Add these **Variables**:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon URL from step 1 |
   | `JWT_SECRET` | any long random string (`openssl rand -hex 32`) |
   | `PORT` | `4000` |
   | `ANTHROPIC_API_KEY` | *(optional)* enables the LLM explanation; blank = deterministic template |
   | `SETTLEMENT_MODE` | leave **unset** — simulated settlement, no chain needed |
4. Deploy. The container runs `prisma migrate deploy` on boot, then starts the API.
   Health check: `GET /health`.
5. **Seed the demo data once** (so there are cases/users to log in as): in the
   Railway service shell (or a one-off command) run:
   ```
   pnpm --filter @gigbridge/backend seed:once
   ```
6. Copy the backend's public URL, e.g. `https://corridor-api.up.railway.app`.

## 3. Frontend — Vercel (free) or Railway static
**Vercel (recommended):** import the repo → **Root Directory = `frontend`** →
framework **Vite** (`frontend/vercel.json` handles SPA routing) → add env
`VITE_API_BASE = https://<your-railway-backend-url>` → deploy.

**Or Railway static:** add a second service, root `frontend`, build
`pnpm install && pnpm --filter @gigbridge/frontend build`, serve `frontend/dist`.

CORS + WebSocket already work: the backend sends permissive CORS and the WS client
derives its host from `VITE_API_BASE`.

## 4. Log in
Demo accounts (after seeding), password `demo1234`:
`novatek@demo.gg` (company) · `priya@demo.gg` (freelancer) · `admin@demo.gg` (admin).

## Notes
- **Cost**: $0 on free tiers for a demo. Watch Railway trial credit + Neon limits.
- **No real money / no real chain** in this mode — simulated settlement, mock USDC.
  Going to a real testnet is a separate step (see `docs/GO_LIVE_PLAN.md`): set
  `RPC_URL`, `CHAIN_ID`, `PLATFORM_PRIVATE_KEY`, `SETTLEMENT_MODE=real`.
- The Dockerfile was authored but **not built in this session** (no Docker locally);
  if the first Railway build surfaces a lockfile/install error, it falls back to a
  non-frozen `pnpm install` (already in the Dockerfile).
