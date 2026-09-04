# Corridor — V2+ implementation record (as-built)

*Created 2026-09-05. Companion to `docs/CORRIDOR_ROADMAP.md` (the "first document" /
single source of truth). The roadmap says **what exists and what's next in one page**;
this document is the **detailed as-built** — the expansion of roadmap §3 into a
subsystem-by-subsystem reference so a new device can understand exactly what is
implemented, where it lives, and how it behaves, without re-reading the code first.*

**Scope of truth:** everything below is present on `main` and verified (109 backend
tests, 34 forge tests, frontend typecheck + `vite build` green) unless a line explicitly
says *proposed* or *not built*. Where this doc and the source ever disagree, **the source
wins** — this is a map, not the territory.

---

## 0. One-paragraph product
Corridor is an autonomous cross-border freelancer-payout gateway: a company pays a
freelancer across borders in minutes at < 1%. An agent verifies both parties once
(reusable, on-chain-anchored credential), a deterministic engine screens every payment
against two jurisdictions, an FX rate is locked, and value settles over an on-chain
escrow (EUR → USDC → INR). Three roles: **Company**, **Freelancer**, **Admin/Operator**.
Corridors: EUR↔INR, USD↔INR. Fee 0.75%. Repo `github.com/LochanPS/Gig-Worker`, branch
`main`. Stack: Fastify · Prisma · Postgres · React/Vite · Foundry/viem.

---

## 1. Smart contracts (`contracts/`, Foundry, 34 tests, signatures FROZEN)
Four contracts, Solidity 0.8.x. ABIs committed to `shared/abis/*.json`. Signatures are
frozen in `docs/BUILD_CONTRACTS.txt §6`.

| Contract | Role | Key surface |
|---|---|---|
| `MockUSDC.sol` | Demo stablecoin | ERC-20, **6 decimals**, `onlyOwner mint(address,uint256)`. Faucet-minted to company wallets at verification. Dropped for real USDC on mainnet (roadmap #15). |
| `IdentityRegistry.sol` | On-chain verification state | `setCredential(address, bytes32 hash, uint64 expiry)`, `revoke(address)`, `isVerified(address) view`. **Stores only the credential hash — never PII** (GDPR / DPDP / Aadhaar Act). |
| `EscrowVault.sol` | **The core** — holds funds between fund and release | `fund(bytes32 id, address payee, uint256 amount, uint256 fee, bytes32 complianceHash)`, `release(id)`, `refund(id)`, `freeze/unfreeze(id)`. Events: `PaymentFunded/Released/Refunded/Frozen`. Guards: OZ `AccessControl` (`PLATFORM_ROLE`) + `ReentrancyGuard`, checks-effects-interactions, verified-party gate via `IdentityRegistry.isVerified`. |
| `AuditAnchor.sol` | Tamper-evident compliance log | `anchor(bytes32 hash)` → `event Anchored(hash, timestamp)`. |

Tested: every state transition + access-control failure + reentrancy. All green.

**Authority model:** `release`/`refund`/`freeze` are `PLATFORM_ROLE` or payer; a **payee
can never release escrow to themselves**.

---

## 2. Settlement seam (`backend/src/modules/settlement/`)
The backend orchestrator **never imports viem or ABIs**. It talks to one port:

```ts
export interface Settlement {
  fund(paymentId, payeeWallet, amountMinor, feeMinor, complianceHash): Promise<{ txHash; escrowId }>;
  release(escrowId): Promise<{ txHash }>;
  refund(escrowId): Promise<{ txHash }>;
  anchorDecision(hash): Promise<{ txHash }>;
}
export const getSettlement: () => Settlement;
export const setSettlement: (s: Settlement) => void;
```

- **`simulatedSettlement`** (default): returns valid-looking tx hashes / escrow ids, no
  external calls. This is also roadmap risk-R1 fallback — the demo runs identically with
  no chain.
- **`real-settlement.ts`** (viem-backed, `SETTLEMENT_MODE=real`): `approve` MockUSDC →
  `EscrowVault.fund` → `release`/`refund`; `AuditAnchor.anchor`; `setCredential` helper for
  the identity flow; an event listener. Registered via `setSettlement()` at boot.
- **`escrowMode` on Payment** decides the shape:
  - `INSTANT` (default): `confirm` runs fund → release → COMPLETED in one request.
  - `HOLD` (FR-2.2): `confirm` funds and **stops at FUNDED**; funds rest on-chain until the
    company calls `POST /payments/:id/release` (minutes or days later). `refund()` reverses.
- **IDs / amounts / hashes (must match exactly):** amounts passed as **minor units**
  (cents/paise); real layer scales to USDC 6-decimals base units (×10^4). `escrowId =
  keccak256(paymentUuid)` (bytes32), stored on `Payment.escrowId`. `complianceHash =
  keccak256(decision)`, passed into `fund()` and anchored.

**What settlement does NOT cover (the seam ends here):** the final **USDC → INR fiat
cash-out** (the "UPI leg"). On-chain `release()` settles value in USDC to the platform/
payee wallet; converting that to INR and pushing it to a freelancer's UPI/bank is the
**off-ramp last mile** — see `docs/SESSION_CAPTURE_2026-09-05.md` for the full spec.

---

## 3. Backend (Fastify · Prisma · 19 modules · 60 routes)
Modules: `auth, verification, customers, directory, payments, payrun, schedules,
invoices, payouts, disputes, compliance, agent, alerts, fx, settlement, documents,
credentials, notifications, admin`.

### 3.1 Identity, verification & credentials
- Register + **self-serve KYC/KYB**. Verification can be **REJECTED** (sanctions / doc /
  tax-id) with a reason + resubmit path — not just a happy path.
- On verify: provisions a wallet + issues an **on-chain-anchored credential**
  (`IdentityRegistry.setCredential`, hash only). Credential is reusable across payments.
- `/me/identity` credential card + certificate; credential PDF.

### 3.2 Customers & directory
- Create/manage parties (`/customers`): admin sees all, a company sees its freelancers.
- A verified freelancer becomes **payable immediately**.

### 3.3 Payments — orchestrator state machine
State machine in `payments/state.ts`; service in `payment.service.ts`. **Four origination
paths** all converge on the same machine:
1. New payout (single)
2. Invoice-approve
3. Batch pay-run
4. Recurring schedule

Happy path: `DRAFT → QUOTED → RATE_LOCKED → (fund) FUNDED → (release) SETTLING → COMPLETED`.
Every public entry point is authorization-gated: `confirm/retry/release/refund` require the
paying company or an admin (`assertPayer`); reads require either party or an admin
(`assertParty`).

### 3.4 Unhappy paths (built, not gestured)
- `RATE_LOCKED → EXPIRED`: a lapsed rate lock is swept (timer + `POST /admin/expire-locks`);
  **no chain call** is made.
- `COMPLIANCE → REJECTED`: the adjudicator rejects some flagged payments before they fund.
- `PAYOUT_FAILED` gate + **retry**: a payment with no valid destination account fails at
  payout and can be retried.
- **Disputes → freeze → REVERSED / dismiss**, refund, expired.

### 3.5 Compliance — deterministic 10-rule engine
- Jurisdiction rules: **India RBI/FEMA, EU AMLD/GDPR, US OFAC** + velocity / structuring /
  outlier heuristics. Screens **every** payment against **two** jurisdictions.
- **Rules decide; the LLM only explains.** The decision **hash is anchored** on-chain
  (`AuditAnchor`) at create time.
- Admin surfaces: `/admin/rules`, `/admin/treasury`.

### 3.6 AI adjudication (`agent/adjudicator.ts`)
- Triages a compliance **FLAG** into `AUTO_CLEAR / AUTO_REJECT / ESCALATE`,
  **confidence-gated**. Sanctions / structuring / high-value **always escalate**.
- LLM or heuristic (env `AI_ADJUDICATION`; heuristic works with no API key). **Only
  exceptions reach the human queue.**
- **Metrics + audit feed (DONE):** `GET /admin/adjudications` counts auto-cleared /
  auto-rejected / escalated and the share settled without a human, from AuditLog rows +
  decision notes (no schema change). Surfaced on the Operator monitor with a live feed of
  each call's confidence + rationale.

### 3.7 FX (`fx/`)
- FX **quote + rate-lock** with a countdown; free **reference** rate today (`fallback.json`
  + `rates.ts`). Executable/firm quotes from a liquidity partner are roadmap #12.

### 3.8 Payout methods (`payouts/`)
- A freelancer must have an **active payout account in the payment's destination currency**
  or the payment lands in `PAYOUT_FAILED`. `hasActivePayoutAccount(userId, currency)` is the
  settlement gate.
- `PayoutAccount`: `label, currency, accountName, accountNumberMasked (last-4), bankIdentifier,
  active`. **Bank-account shaped only today — no UPI/VPA method yet** (see UPI-leg spec).

### 3.9 Documents (PDFs)
- Receipt / compliance / FIRC / credential PDFs, backend-generated. Payment documents render
  from `GET /payments/:id/documents`; unavailable ones carry the backend's reason.

### 3.10 Notifications & alerts
- Notification centre (bell + unread badge + history + mark read/all) and live toasts over
  websocket. *(Caveat: the websocket was silently broken until 2026-09-04 — wrong
  `@fastify/websocket` API — so no live event had ever reached a browser before that fix.
  See `CONTRACTS_AND_SETTLEMENT.txt §10`.)*

---

## 4. Frontend (React/Vite, "êxponent" design)
Satoshi + JetBrains Mono, amber/off-white. Built and wired:
- **Login** (+ signup)
- **Company**: Overview v2, New payout, Batch pay, Recurring, Invoices, Customers, Verify
- **Freelancer**: Earnings, Invoices, Payout methods
- **Admin**: Operator-monitor v2 (adjudication metrics + feed, rules, treasury)
- **Payment detail**: timeline, PDFs, dispute, retry
- **New-payout flow (polished):** 4-step stepper, payee search, currency + **labelled FEMA
  purpose-code** pickers, live re-quoting, vs-incumbent strip, **rate-lock countdown ring**
  that disables confirm when the lock lapses, inline "＋ New payee" (creates + verifies
  without leaving the flow).

**Local demo preview (no DB):** serve `frontend/dist` with the mock injector
(`inject-mock.mjs`, scratch-only, not committed) + `vite preview`; the role switcher toggles
company/freelancer/admin.

> The richer 18-route visx-chart frontend lives in `variants/frontend-rich/` and is
> **preserved, not wired** (roadmap decision 2026-09-04: not adopting — the live app carries
> the Corridor branding, êxponent design and every feature page; the variant predates all of
> it and targets the old API).

---

## 5. Deploy prep
`deploy/backend.Dockerfile`, `railway.json`, `DEPLOY_RAILWAY.md`, `vercel.json`. Prisma
**migrations are committed but not applied** to any live DB — run `prisma migrate deploy` at
hosting time. Frontend defaults `VITE_API_BASE` to the Railway backend when unset.

---

## 6. Verification / how to prove it (no pnpm needed — local bins)
- shared: `cd shared && ./node_modules/.bin/tsc`
- backend: `cd backend && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run`  → 109 tests
- frontend: `cd frontend && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
- contracts: `cd contracts && forge test`  → 34 tests

If backend typecheck shows unknown model/field errors after a schema change, the Prisma
client is stale (it's gitignored): `DATABASE_URL=... prisma generate`. `shared/dist` is also
gitignored — rebuild `shared` after editing `shared/src`.

---

## 7. Coverage snapshot (mirrors roadmap §5)
| Layer | Covered | Gap |
|---|---|---|
| Backend | ~95% | external vendor integrations are seams, not live |
| Contracts & settlement | core 100% (4 contracts, 34 tests, sim+real, listener) | audit, real USDC, kill-switch, custody, public testnet, **INR off-ramp / UPI leg** |
| Agent | explanation ✓ + payment adjudication ✓ + metrics ✓ | dispute triage, tuning, case management |
| Frontend | ~98% | rich-charts variant decision (roadmap #8) |

The **UPI leg / INR off-ramp** is the most demo-relevant gap and is specified in full in
`docs/SESSION_CAPTURE_2026-09-05.md §3`.
