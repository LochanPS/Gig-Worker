GIGBRIDGE — Autonomous Cross-Border Freelancer Payment Gateway
==============================================================

Hackathon Problem Statement 1: compliant, low-cost, near-instant direct
payments between companies and freelancers across borders, with an
autonomous agent handling identity, regulation (RBI/FEMA, EU AMLD/GDPR,
US OFAC), real-time FX, and blockchain settlement.

Documents in this repository (read in this order):
  1. PRD.txt                    — Product requirements: problem, users,
                                  solution, features, business model.
  2. TRD.txt                    — Technical requirements: stack decision
                                  (Solidity + TypeScript; why not go-zero),
                                  architecture, contracts, API, data model.
  3. UI_SPEC.txt                — Full spec of the three dashboards
                                  (Company / Freelancer / Admin).
  4. ROADMAP_3_PERSON_3_DAY.txt — Parallel build plan for three
                                  simultaneous build tracks + 90-day
                                  business roadmap.
  5. DEMO_SCRIPT.txt            — Minute-by-minute pitch/demo choreography
                                  and prepared judge Q&A.

Repo layout:
  /shared     TypeScript types, enums, constants, zod schemas, ABIs — the
              frozen interface treaty every track imports (@gigbridge/shared).
  /backend    Fastify API + agent + rule engine (P2). /backend/mock is a
              stand-in API server so the frontend can build immediately.
  /frontend   React SPA, three dashboards (P3).
  /contracts  Foundry project: escrow, registry, mock USDC, audit anchor (P1).
  /infra      docker-compose stack.
  /docs       PRD, TRD, UI spec, roadmap, demo script, build contract, prompts.

Quick start (scaffold stage):
  pnpm install
  pnpm --filter ./backend mock     # mock API on http://localhost:4000
  cp .env.example .env             # then fill in as real services land

Coordination: docs/BUILD_CONTRACTS.txt is the frozen contract; log any change
to it or /shared in INTEGRATION_LOG.txt in the same commit.
