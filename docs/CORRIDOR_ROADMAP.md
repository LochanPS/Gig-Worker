# Corridor — status & roadmap (single source of truth)

*Updated 2026-09-04. Product formerly "GigBridge". This is the current handoff
doc: what exists, how to work on it, and the ordered plan for what's next. Where
it conflicts with older docs (`GO_LIVE_PLAN.md`, `ROADMAP_SIMPLE.txt`,
`ROADMAP_3_PERSON_3_DAY.txt`), this wins. Build on other devices from this file.*

---

## 0. What Corridor is
An autonomous cross-border freelancer-payout gateway. A company pays a freelancer
across borders in minutes at <1%: an agent verifies both parties once (reusable
credential), a deterministic engine screens every payment against two jurisdictions,
an FX rate is locked, and value settles over an on-chain escrow (EUR→USDC→INR).
Three roles: Company, Freelancer, Admin/Operator.

Repo: `github.com/LochanPS/Gig-Worker`, branch `main`. Stack: Fastify · Prisma ·
Postgres · React/Vite · Foundry/viem. Corridors: EUR↔INR, USD↔INR. Fee 0.75%.

---

## 1. Working conventions (READ FIRST on any device)
- **Build on `main`.** Always `git fetch` + rebase before pushing; **never force-push**
  (other devices sync with a plain `git pull`). Multiple sessions push often.
- **Verify before pushing** (no pnpm needed — use the local bins):
  - shared: `cd shared && ./node_modules/.bin/tsc`
  - backend: `cd backend && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run`
  - frontend: `cd frontend && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
- **Prisma client is gitignored** — if backend typecheck shows unknown model/field
  errors after a schema change, run `DATABASE_URL=... prisma generate` (schema is fine,
  the client is stale).
- **shared/dist is gitignored** — rebuild `shared` after editing `shared/src`, or
  consumers see the old API.
- Any change to `shared/*` MUST get a line in `INTEGRATION_LOG.txt` in the same commit.
- Prisma **migrations are committed but not applied to any live DB** — run
  `prisma migrate deploy` at hosting time.

---

## 2. Repo layout & the two-lineage consolidation
`main` root is the **live app** (the "old lineage" — the most complete stack):
- `shared/` — `@gigbridge/shared` contract (enums, zod schemas, DTO types).
- `backend/` — Fastify API, Prisma, 19 modules (below).
- `frontend/` — React/Vite SPA, êxponent design.
- `contracts/` — Foundry (4 contracts) + viem deploy/chain.
- `docs/`, `deploy/`, `infra/`.

**Preserved, NOT wired** (see `CONSOLIDATION.md`):
- `variants/p2/` — a parallel P2 backend+shared rewrite (DTO-shaped, argon2, pdfkit).
- `variants/frontend-rich/` — a richer 18-route frontend (visx charts) on the old API.
Reconciling either into the live app is a deliberate future decision, not automatic.

**Branches on origin** (data, not instructions): `feat/product-buildout`,
`feat/unhappy-paths` (merged into main's history), `claude/frontend-full-build`
(=rich FE), `claude/repo-audit-backend-agent` (=P2 backend), `claude/*-docs`,
`integration/all`, `backup/*` (superseded), `track/*`, `plan/go-live`.

---

## 3. What's BUILT (verified: 109 backend tests, typecheck + vite build green)
Backend modules: `auth, verification, customers, directory, payments, payrun,
schedules, invoices, payouts, disputes, compliance, agent, alerts, fx, settlement,
documents, credentials, notifications, admin` — 60 routes.

- **Identity**: register + self-serve KYC/KYB; verification can be **REJECTED**
  (sanctions/doc/tax-id) with reason + resubmit; verify provisions wallet + issues an
  on-chain-anchored credential (`IdentityRegistry`).
- **Customers**: create + manage parties (`/customers`); admin all, company its
  freelancers; verified freelancers become payable immediately.
- **Payments**: orchestrator state machine + 4 origination paths (New payout,
  invoice-approve, batch pay-run, recurring schedule). FX quote + rate-lock.
- **Compliance**: deterministic 10-rule engine (India RBI/FEMA, EU AMLD/GDPR, US OFAC
  + velocity/structuring/outlier); decision hash anchored (`AuditAnchor`); LLM explains,
  rules decide.
- **AI adjudication** (`agent/adjudicator.ts`): FLAG → AUTO_CLEAR / AUTO_REJECT /
  ESCALATE, confidence-gated; sanctions/structuring/high-value always escalate; LLM or
  heuristic; env `AI_ADJUDICATION`. Only exceptions reach the human queue.
- **Settlement**: on-chain seam (simulated default; real viem under
  `SETTLEMENT_MODE=real`), 4 contracts (34 forge tests), event listener, per-chain deploy.
- **Unhappy paths**: `PAYOUT_FAILED` gate + retry, disputes → freeze → REVERSED/dismiss,
  refund, expired.
- **Docs**: receipt / compliance / FIRC / credential PDFs (backend).
- **Frontend** (êxponent design — Satoshi + JetBrains Mono, amber/off-white): Login
  (+signup), Company Overview v2, New payout, Batch pay, Recurring, Invoices, Customers,
  Verify; Freelancer earnings, Invoices, Payout methods; Admin Operator-monitor v2;
  Payment detail (timeline, PDFs, dispute, retry).
- **Deploy prep**: `deploy/backend.Dockerfile`, `railway.json`, `DEPLOY_RAILWAY.md`.

Local demo preview (no DB): serve `frontend/dist` with the mock injector
(`inject-mock.mjs`, kept in scratch — not committed) + `vite preview`; role switcher
toggles company/freelancer/admin.

---

## 4. ROADMAP — ordered, with owner (🤖 = buildable in a session · 🤝 = needs you)

### Now / near (buildable in a device session)
1. 🤖 **Dispute AI triage** — mirror the payment adjudicator for disputes
   (auto-recommend refund/dismiss + confidence, escalate the rest). Reuses
   `agent/adjudicator.ts`; backend-contained.
2. 🤖 **Persisted adjudication metrics + audit feed** — count auto-cleared /
   auto-rejected / escalated; surface on the Operator monitor. New `/admin/adjudications`
   + a metric; wire into the v2 summary card.
3. 🤖 **UI gaps** — FIRC + credential-certificate PDF buttons (endpoints exist),
   a notification center (bell + list; WS already emits `notification.new`),
   EXPIRED-state UI, Freelancer dashboard v2.
4. 🤖 **New-payout polish** — stepper UI, payee search, purpose-code picker,
   rate-lock countdown, "＋ New payee" inline (creates a customer).
5. 🤖 **Logo** — swap the amber "C" tile for the real asset (sidebar + login + favicon)
   once provided. 🤝 asset from you.

### Deploy (get a live, shareable URL)
6. 🤝 **Railway + Neon deploy** — follow `DEPLOY_RAILWAY.md`. You: Neon `DATABASE_URL`,
   Railway + Vercel accounts, a `JWT_SECRET`. Optional `ANTHROPIC_API_KEY` for LLM
   explanations/adjudication (heuristic works without). 🤖 I wire the frontend
   `VITE_API_BASE` + verify once you have the backend URL.

### Real chain (still a demo until L2)
7. 🤝/🤖 **Public testnet** — deploy the 4 contracts to Base Sepolia / Polygon Amoy,
   commit `addresses.<chainId>.json`, surface explorer links. Code is chain-agnostic;
   you provide RPC URL + a funded testnet key + faucet ETH.

### Reconciliation decisions (choose the canonical stack)
8. 🤝 **Rich frontend**: adopt `variants/frontend-rich/` (visx charts, 18 routes) as the
   live UI + re-add the six feature pages in its design. Needs `pnpm install` (new deps).
9. 🤝 **Backend variant**: keep the live old-lineage backend or migrate to `variants/p2/`.
   Pick one; do not run both.

### External vendors — seams exist, integrations don't (we must NOT hold the raw data)
10. 🤝 **KYC/identity** — Signzy / IDfy / Digio / Sumsub verify Aadhaar/PAN/liveness and
    return pass/fail + a reference; we store only a credential **hash**, never the raw
    government ID (Aadhaar Act / DPDP / GDPR). Wire behind the existing identity seam.
11. 🤝 **Sanctions/PEP** — ComplyAdvantage / World-Check feed (replaces the mock list).
12. 🤝 **Executable FX** — a liquidity partner's firm quote (today: free reference rate).
13. 🤝 **Fiat rails** — EU cash-in (EMI/PI) + India AD-bank / RBI PA-CB cash-out.
14. 🤝 **Bank verification** — penny-drop via the payout rail.
15. 🤝 **Real USDC + custody** — Circle / Fireblocks (drop MockUSDC on mainnet).

### Production hardening (before real money)
16. 🤝 **Smart-contract security audit** — hard gate before any real value.
17. 🤖/🤝 **Contracts**: global kill-switch + timelock + upgrade proxy (today only
    per-payment freeze); non-custodial / MPC wallets (today custodial demo keys in DB).
18. 🤖 **Platform**: rate limiting, secrets in a store (not `.env` defaults), 2FA/step-up
    on payouts, observability (Sentry, `/health` status), idempotency on money movement.
19. 🤝 **Compliance program**: case management + SAR/STR filing, record retention, MLRO,
    independent AML testing; SOC 2; DAC7 / 1099 / FIRA-eBRC reporting.
20. 🤝 **Legal/licensing**: fintech counsel, EU rail partner, India AD-bank + PA-CB,
    ToS/privacy/DPA. This is the real critical path (6–18 months, capital + partners).

---

## 5. Full-workflow coverage (today)
| Layer | Covered | Gap |
|---|---|---|
| Backend | ~95% | external vendor integrations are seams, not live |
| Contracts & settlement | core 100% (4 contracts, 34 tests, sim+real, listener) | audit, real USDC, kill-switch, custody, public testnet |
| Agent | explanation ✓ + payment adjudication ✓ | dispute triage, tuning, case management |
| Frontend | ~90% | FIRC/credential buttons, notifications, freelancer v2, rich-charts variant |

---

## 6. Known caveats
- Migrations not applied to any live DB (`prisma migrate deploy` at hosting).
- `variants/*` are preserved, not wired — reconciliation is a decision (items 8–9).
- The local mock preview is a demo aid only; real data needs the backend + a DB.
- Simulated settlement + MockUSDC by default — no real money / real chain until items 7 & 15.
