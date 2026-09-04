# GigBridge — Backend & Agent (P2 track)

Autonomous cross-border freelancer payment gateway. This package covers the
**Backend & Agent** track: the Fastify API, Prisma data model, payment
orchestrator state machine, FX service, deterministic compliance engine, the
LLM agent (with offline template fallback), anomaly detection, websocket push,
seed data, invoices and PDF endpoints.

The `/contracts` (chain & settlement, P1) and `/frontend` (P3) tracks live in
their own workspace packages. The frozen interface between all three is
[`docs/BUILD_CONTRACTS.txt`](docs/BUILD_CONTRACTS.txt).

## Quickstart

```bash
pnpm install
cp .env.example .env            # fill nothing to run fully offline/demo
docker compose up -d postgres   # or point DATABASE_URL at your own PG
pnpm db:migrate
pnpm seed                       # demo users, history, alerts (BUILD_CONTRACTS §7)
pnpm dev                        # http://localhost:4000  (REST /api/v1, WS /ws)
```

Whole-stack demo:

```bash
docker compose up               # postgres + anvil + backend, auto-migrate + seed
```

Frontend-only mock (serves every REST path with seed-shaped fake data, no DB):

```bash
pnpm dev:mock                   # http://localhost:4000
```

## Layout

```
shared/     types + zod schemas + websocket events (the interface treaty)
backend/    Fastify API, orchestrator, compliance, agent, fx, seed
  src/auth          register/login/JWT/RBAC
  src/identity      KYC/KYB + verifiable-credential issuance
  src/fx            live rates + offline fallback + quote/lock
  src/payments      lifecycle state machine + orchestrator
  src/compliance    10 deterministic rules + anomaly detection
  src/agent         LLM reasoning trace + deterministic template fallback
  src/settlement    typed interface; real viem impl is delivered by P1
  src/admin         queue / alerts / metrics / rules registry
  src/invoices      invoice create + approve->payment draft
  src/documents     PDF receipt / compliance report
  src/ws            authenticated websocket hub
  src/seed          demo seed + demo:reset
contracts/  Foundry project (P1 track)
frontend/   React SPA (P3 track)
docs/       PRD / TRD / roadmap / specs
```

## Offline / demo safety

- `FX_OFFLINE=true` → rates come from `backend/src/fx/fallback.json`.
- Empty `ANTHROPIC_API_KEY` → agent uses deterministic template explanations.
- Empty `PLATFORM_PRIVATE_KEY` / no chain → settlement runs in **simulated**
  mode (deterministic fake tx hashes) so the pipeline completes without anvil.

Deterministic rules always decide; the LLM only explains. See
[`docs/TRD.txt`](docs/TRD.txt) §4.6.
