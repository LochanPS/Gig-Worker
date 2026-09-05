# Master feature index — everything discussed & built (session 2026-09-05)

*Created 2026-09-05. This is the **flat, numbered index** of every feature and concept raised
across the parallel "freelance-escrow" session and its reconciliation into Corridor — the
"list of everything, nothing skipped" entry point. It does not re-explain each item; it
**enumerates** them and points to the one document that specifies each in full, and says
plainly whether the thing is **built**, **spec'd**, or **needs an external partner**.*

**Read order for a new device:** this file (the map of everything) → `CORRIDOR_ROADMAP.md`
(source of truth) → `CORRIDOR_V2_IMPLEMENTED.md` (detailed as-built) →
`SESSION_CAPTURE_2026-09-05.md` (session + UPI spec) → `EXECUTION_PLAN_UPI_LEG.md` (build plan).

**Status legend**
- ✅ **BUILT** — present on `main`, verified (109 backend tests · 34 forge tests · frontend tsc + `vite build`).
- 🧩 **SPEC'D** — designed in full in a doc, **not yet code** (buildable now, no external dependency).
- 🏗️ **WIP (uncommitted)** — a prior session began this in a scratch worktree; not committed, not verified (see §7).
- 🤝 **NEEDS YOU** — blocked on an external partner, license, key, or asset; code seam may already exist.

Every row names the **doc** that carries the detail: **RM** = `CORRIDOR_ROADMAP.md`,
**V2** = `CORRIDOR_V2_IMPLEMENTED.md`, **SC** = `SESSION_CAPTURE_2026-09-05.md`,
**EP** = `EXECUTION_PLAN_UPI_LEG.md`.

---

## A. Core platform — BUILT and on `main`

| # | Feature | Status | Where it lives | Detail |
|---|---|---|---|---|
| A1 | **Identity / KYC-KYB** — register + self-serve verification, REJECT (sanctions/doc/tax-id) + reason + resubmit | ✅ | `backend/…/verification` | V2 §3.1, RM §3 |
| A2 | **On-chain-anchored credential** — wallet provisioned on verify; reusable credential; hash only, never PII | ✅ | `IdentityRegistry.sol`, `credentials` | V2 §1, §3.1 |
| A3 | **Customers & directory** — create/manage parties; admin sees all, company sees its freelancers; verified freelancer payable immediately | ✅ | `backend/…/customers`, `directory` | V2 §3.2 |
| A4 | **Payment orchestrator state machine** — single source of legal transitions; `DRAFT→QUOTED→RATE_LOCKED→FUNDED→SETTLING→COMPLETED` | ✅ | `payments/state.ts`, `payment.service.ts` | V2 §3.3 |
| A5 | **Four origination paths** — single payout, invoice-approve, batch pay-run, recurring schedule (all converge on one machine) | ✅ | `payments`, `payrun`, `schedules`, `invoices` | V2 §3.3 |
| A6 | **FX quote + rate-lock** — countdown ring, live re-quote, reference rate today | ✅ | `fx/` (`rates.ts`, `fallback.json`) | V2 §3.7 |
| A7 | **Compliance — deterministic 10-rule engine** — India RBI/FEMA, EU AMLD/GDPR, US OFAC + velocity/structuring/outlier; screens every payment vs two jurisdictions | ✅ | `compliance/rules/*` | V2 §3.5 |
| A8 | **Decision hash anchored on-chain** — compliance decision hash written to `AuditAnchor` at create time; rules decide, LLM only explains | ✅ | `AuditAnchor.sol`, `compliance` | V2 §1, §3.5 |
| A9 | **AI adjudication** — FLAG → AUTO_CLEAR / AUTO_REJECT / ESCALATE, confidence-gated; sanctions/structuring/high-value always escalate; LLM or heuristic | ✅ | `agent/adjudicator.ts` | V2 §3.6 |
| A10 | **Adjudication metrics + live audit feed** — `GET /admin/adjudications`, share settled without a human, per-call confidence + rationale on Operator monitor | ✅ | `agent`, `admin` | V2 §3.6, RM §4.2 |
| A11 | **On-chain escrow** — fund/release/refund/freeze; OZ AccessControl + ReentrancyGuard; payee can never self-release | ✅ | `EscrowVault.sol` | V2 §1 |
| A12 | **Escrow modes INSTANT vs HOLD** — INSTANT settles in one request; HOLD stops at FUNDED until company releases | ✅ | `settlement`, `Payment.escrowMode` | V2 §2 |
| A13 | **Settlement seam (port)** — orchestrator never imports viem; `simulatedSettlement` default, `real-settlement.ts` under `SETTLEMENT_MODE=real`; event listener | ✅ | `backend/…/settlement/` | V2 §2 |
| A14 | **Demo stablecoin** — `MockUSDC` 6-dec ERC-20, faucet-mint on verify | ✅ | `MockUSDC.sol` | V2 §1 |
| A15 | **Unhappy paths** — `RATE_LOCKED→EXPIRED` sweep (no chain call), `COMPLIANCE→REJECTED`, `PAYOUT_FAILED` gate + retry | ✅ | `payments/state.ts`, `admin` | V2 §3.4 |
| A16 | **Disputes → freeze → REVERSED / dismiss** — refund + expired paths; admin-driven | ✅ | `disputes` | V2 §3.4, SC §2 |
| A17 | **Payout accounts + settlement gate** — `hasActivePayoutAccount(userId,currency)`; no active dest-currency account ⇒ `PAYOUT_FAILED`; account numbers masked (last-4) | ✅ | `payouts/payout-account.service.ts` | V2 §3.8 |
| A18 | **Documents / PDFs** — receipt, compliance, **FIRC**, credential; render from `GET /payments/:id/documents` with reason when unavailable | ✅ | `documents` | V2 §3.9 |
| A19 | **Notifications & alerts** — notification centre (bell, unread badge, history, mark read/all) + live websocket toasts | ✅ | `notifications`, `alerts` | V2 §3.10 |
| A20 | **Websocket transport** — the live channel itself (was silently broken until 2026-09-04; wrong `@fastify/websocket` API) | ✅ | `ws` | V2 §3.10, RM §6 |
| A21 | **Frontend — Company** — Overview v2, New payout, Batch pay, Recurring, Invoices, Customers, Verify | ✅ | `frontend/src/pages/company` | V2 §4 |
| A22 | **Frontend — Freelancer** — Earnings, Invoices, Payout methods | ✅ | `frontend/src/pages/freelancer` | V2 §4 |
| A23 | **Frontend — Admin/Operator** — Operator-monitor v2 (adjudication metrics + feed, `/admin/rules`, `/admin/treasury`) | ✅ | `frontend/src/pages/admin` | V2 §4 |
| A24 | **New-payout flow (polished)** — 4-step stepper, payee search, currency + **labelled FEMA purpose-code** pickers, live re-quote, vs-incumbent strip, rate-lock countdown ring, inline "＋ New payee" | ✅ | `frontend` new-payout | V2 §4, RM §4.4 |
| A25 | **Payment detail** — timeline, PDFs, dispute, retry | ✅ | `frontend` payment detail | V2 §4 |
| A26 | **êxponent design system** — Satoshi + JetBrains Mono, amber/off-white | ✅ | `frontend` | V2 §4 |
| A27 | **Local demo preview (no DB)** — serve `frontend/dist` with mock injector + `vite preview`; role switcher | ✅ | `inject-mock.mjs` (scratch, not committed) | V2 §4 |
| A28 | **Deploy prep** — `deploy/backend.Dockerfile`, `railway.json`, `DEPLOY_RAILWAY.md`, `vercel.json`; frontend defaults `VITE_API_BASE` to Railway backend | ✅ | `deploy/` | V2 §5 |

---

## B. The UPI leg / INR off-ramp last mile — the one genuine gap (SPEC'D)

*Full spec: **SC §3**. Ordered build plan: **EP** (8 phases). This is the USDC→INR fiat last
mile — what turns `COMPLETED` from "settled in USDC" into "₹ in the freelancer's UPI app."
The simulated path is fully buildable now, no license.*

| # | Piece | Status | Detail |
|---|---|---|---|
| B1 | **`PayoutRail` port** — `quoteOffRamp` / `execute` / `status`; `getPayoutRail`/`setPayoutRail`, mirrors the settlement port | 🧩 | SC §3.2, EP P3 |
| B2 | **`simulatedPayoutRail`** — deterministic USDC→INR, returns `railRef` + `CREDITED` | 🧩 | SC §3.2, EP P3 |
| B3 | **UPI QR / deep link** — `upi://pay?pa=<vpa>&am=<inr>&tn=<ref>&cu=INR`, scannable in the demo | 🧩 | SC §3.2, §4.3, EP P3 |
| B4 | **`PayoutAccount.method` (BANK\|UPI) + `vpa`** — UPI as a payout method, back-compat default BANK | 🧩🏗️ | SC §3.3, EP P1–P2 |
| B5 | **VPA validation** `handle@psp` + penny-drop / VPA-validate; store PSP-returned name | 🧩🤝 | SC §3.3, RM §4.14 |
| B6 | **Drive `CREDITED` via the off-ramp** — no new `PaymentState`; off-ramp is the mechanism on `SETTLING→COMPLETED` | 🧩🏗️ | EP (locked decision 1), SC §3.4 |
| B7 | **`Payment.payoutRailRef` + `payoutMethod`** — how the INR was delivered, for FIRC + UI | 🧩🏗️ | EP P2 |
| B8 | **PA-CB per-transaction limit** — a normal deterministic `Rule` (USD-2,000 class) → FLAG → adjudicator; `legalRef = RBI PA-CB` | 🧩 | SC §3.5, EP P5 |
| B9 | **FIRC reflects the rail reference** — wire `railRef` + masked destination into the FIRC PDF | 🧩 | SC §3.5, EP P6 |
| B10 | **Frontend — UPI method + QR + credited** — BANK/UPI toggle on Payout methods; QR + "on its way / credited to name@psp" on payment detail | 🧩 | EP P7 |
| B11 | **`realPayoutRail`** — licensed PA-CB / AD-bank partner; `setPayoutRail()` at boot, orchestrator unchanged | 🤝 | SC §3.6, RM §4.13 |

---

## C. Other session concepts — reconciled, DO NOT rebuild

*These were raised in the session (mostly via the redundant `freelance-escrow` folder). Each
already exists in Corridor, equal or better. Listed so nobody re-implements them by mistake.
Full reconciliation table: **SC §2**.*

| # | Session concept | Verdict | Corridor equivalent |
|---|---|---|---|
| C1 | Escrow holding funds between pay & release | Covered, better | A11–A13 (`EscrowVault`, HOLD/INSTANT, freeze) |
| C2 | Decentralized identity / DID | Covered in spirit | A2 — credential **hash** anchor (not W3C DID; see D-note) |
| C3 | Stablecoin | Covered for demo | A14 (`MockUSDC`); real USDC = RM §4.15 |
| C4 | Disputes / single arbiter | Covered, better | A16 dispute→freeze→reverse + A9 AI triage |
| C5 | FX | Covered | A6 |
| C6 | Compliance | Covered, far better | A7–A8 (10-rule, anchored) |
| C7 | UPI QR cash-out | **Genuine gap** | → **Section B** (the only net-new work) |

**Recorded decisions from the session (not gaps):**
- **C8 — Full W3C DID / verifiable-credential wallet** vs today's credential-hash: a *product
  decision*, not a bug. Hash-anchor is the right call for demo + GDPR/DPDP minimization. Park as
  a future option. (SC §4.1)
- **C9 — UPI QR as a first-class artifact**, not just a demo prop: keep it in the simulated rail
  so it survives into the real one as a "pay to this VPA" fallback. (SC §4.3)

---

## D. Roadmap open items (from `CORRIDOR_ROADMAP.md §4)

**Buildable in a device session (🤖):**
| # | Item | Status | Detail |
|---|---|---|---|
| D1 | **Dispute AI triage** — mirror `agent/adjudicator.ts` for disputes (recommend refund/dismiss + confidence, escalate rest) | 🧩 | RM §4.1, SC §4.2, EP "adjacent item" |
| D2 | **Logo swap** — replace amber "C" tile once the asset is provided | 🤝 (asset) | RM §4.5 |

**Deploy / chain (mostly 🤝):**
| # | Item | Status | Detail |
|---|---|---|---|
| D3 | **Railway + Neon deploy** — live shareable URL; you provide Neon `DATABASE_URL`, accounts, `JWT_SECRET` | 🤝 | RM §4.6 |
| D4 | **Public testnet** — deploy 4 contracts to Base Sepolia / Polygon Amoy, commit `addresses.<chainId>.json`, explorer links; you provide RPC + funded key | 🤝/🤖 | RM §4.7 |

**Reconciliation decisions:**
| # | Item | Status | Detail |
|---|---|---|---|
| D5 | **Rich frontend variant** (`variants/frontend-rich/`, visx, 18 routes) | 🤝 decision — **NOT adopting** (2026-09-04) | RM §4.8 |
| D6 | **Backend variant** (`variants/p2/`) — keep live backend or migrate; pick one | 🤝 decision | RM §4.9 |

**External vendors — seams exist, integrations don't (🤝):**
D7 KYC/identity (Signzy/IDfy/Digio/Sumsub) · D8 Sanctions/PEP (ComplyAdvantage/World-Check) ·
D9 Executable FX (liquidity partner) · D10 Fiat rails (EU cash-in + India AD-bank/PA-CB) ·
D11 Bank verification (penny-drop) · D12 Real USDC + custody (Circle/Fireblocks). → RM §4.10–4.15

**Production hardening before real money (🤝/🤖):**
D13 Smart-contract security audit · D14 Contracts kill-switch/timelock/upgrade proxy + non-custodial/MPC ·
D15 Platform (rate limiting, secret store, 2FA/step-up on payouts, observability, idempotency) ·
D16 Compliance program (case mgmt, SAR/STR, retention, MLRO, SOC 2, DAC7/1099/eBRC) ·
D17 Legal/licensing (EU rail, India AD-bank + PA-CB) — the real critical path. → RM §4.16–4.20

---

## E. Document map — which file answers which question

| If you want… | Read |
|---|---|
| The flat list of everything (this) | `FEATURE_INDEX.md` |
| Source of truth: what exists, conventions, ordered roadmap | `CORRIDOR_ROADMAP.md` |
| Detailed as-built, subsystem by subsystem | `CORRIDOR_V2_IMPLEMENTED.md` |
| What the parallel session raised + full UPI-leg spec | `SESSION_CAPTURE_2026-09-05.md` |
| Ordered, phase-gated plan to build the UPI leg | `EXECUTION_PLAN_UPI_LEG.md` |
| Contract signatures (frozen) + settlement details | `BUILD_CONTRACTS.txt`, `CONTRACTS_AND_SETTLEMENT.txt` |
| Demo walkthrough | `DEMO_SCRIPT.txt` |
| AI adjudication / operations detail | `AI_ADJUDICATION_AND_OPERATIONS.md` |

---

## F. Continue on another device — quickstart

1. `git fetch origin && git checkout main && git pull` — the docs above live on **`main`**
   (not on `track/frontend`). Build on `main` per RM §1.
2. Read this file, then the four companion docs in the order in §E.
3. **Do not rebuild** anything in Section A or C — it already exists on `main`.
4. To build the demo's headline gap, execute the **UPI leg** via `EXECUTION_PLAN_UPI_LEG.md`,
   phase by phase (simulated path needs no license, no external account).
5. **Heads-up (see §7):** a prior session began Phases 1–2/4 of the UPI leg in a scratch
   worktree but **never committed** it. Treat the execution plan as the authority and
   re-derive from a clean `main`; don't assume that WIP is correct or present.
6. Repo conventions: verify before push (tsc + vitest + vite build), `git fetch` + rebase,
   **never force-push**, log any `shared/*` change in `INTEGRATION_LOG.txt`, migrations
   committed but not applied.

---

## 7. Known loose end at time of writing (2026-09-05)

An uncommitted work-in-progress of the UPI leg exists in a **separate session's scratch
worktree** (Phases ~1–2/4 of `EXECUTION_PLAN_UPI_LEG.md`: `shared/src/{enums,schemas,types}.ts`,
`payouts/payout-account.service.ts`, `backend/prisma/schema.prisma`, and a
`20260905060000_upi_leg` migration). It is **not committed, not verified, and not on `main`**.
It is recorded here only so it is not mistaken for finished work — the execution plan is the
source of truth for that build. If that session lands and verifies it, mark B4/B6/B7 ✅ and tick
the EP progress log.

---

*This index is intentionally exhaustive per the request: every feature and concept from the
session appears exactly once, mapped to built (A), the UPI gap (B), reconciled-already (C), or
open roadmap (D). If a future reader finds a session idea missing here, add it to the right
section rather than assuming it was never discussed.*
