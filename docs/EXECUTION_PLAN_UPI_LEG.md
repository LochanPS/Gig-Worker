# Execution plan — bring the UPI leg (and the rest of the session) into the app

*Created 2026-09-05. This is the **ordered build plan** that turns the design in
`SESSION_CAPTURE_2026-09-05.md §3` into working, tested, pushed code, so that everything
discussed in the parallel session is actually **present in the application**. It is written
to be executed one phase at a time, on `main`, with a verify+push gate at the end of each
phase. Any device can pick up at the next unchecked phase.*

**Definition of done:** a company pays a freelancer EUR/USD → the value settles on-chain in
USDC → an **off-ramp delivers INR to the freelancer's UPI ID (or bank)** → the UI shows the
credit + a scannable UPI QR → the FIRC reflects the off-ramp reference. All simulated
(no license needed), swappable for a real PA-CB partner with zero orchestrator change.

**What "everything present" can and cannot mean (honest boundary):**
- **In the app after this plan (simulated, demoable):** UPI as a payout method, USDC→INR
  off-ramp, credited state + UPI QR, PA-CB limit rule, FIRC with the rail reference.
- **Still a seam, needs YOU (not autonomously buildable):** the *real* licensed PA-CB /
  AD-bank rail, executable FX, real USDC/custody, and the deploy/testnet keys. These are
  roadmap #7, #12, #13, #15, #20 and are gated on partners/licensing, not code.

---

## Design decisions locked before building (grounded in the real code)
1. **No new `PaymentState`.** The machine already ends `SETTLING → COMPLETED` with a
   `CREDITED` ("Payee credited") timeline step (`payments/state.ts`). The off-ramp is the
   *mechanism* that drives that step — it does not add a state. Lower blast radius, no
   status-chip churn.
2. **Mirror the settlement port.** A new `PayoutRail` port (simulated default + real swap)
   exactly like `settlement.interface.ts`. The orchestrator never learns the vendor.
3. **UPI is a payout method, not a new entity.** Extend `PayoutAccount` with
   `method: BANK|UPI` + `vpa`; `hasActivePayoutAccount()` (the existing pre-funding gate)
   already makes a UPI account a valid INR destination — so it just works.
4. **Compliance stays deterministic.** The PA-CB per-transaction cap is a normal `Rule`
   (pure `evaluate(ctx)`), so a breach flows through the existing FLAG → adjudicator path.
5. **Additive, reversible, convention-respecting.** Build on `main`, verify before push,
   never force-push, log every `shared/*` change in `INTEGRATION_LOG.txt`, migrations
   committed but not applied.

---

## Phase 0 — environment & green baseline  ☐
- Dedicated worktree on `main`; install deps so verification runs (`shared`, `backend`,
  `frontend` — node_modules is gitignored, every device installs).
- **Baseline verify BEFORE touching anything:** `shared` tsc · `backend` tsc + `vitest run`
  (expect 109 green) · `frontend` tsc + `vite build`. Record the numbers.
- Gate: baseline green. *(No commit — this phase only proves the starting point.)*

## Phase 1 — shared contract (the API surface both ends agree on)  ☐
Files: `shared/src/enums.ts`, `shared/src/schemas.ts`, `shared/src/types.ts`,
`INTEGRATION_LOG.txt`.
- `enums.ts`: `PAYOUT_METHODS = ['BANK','UPI'] as const` + `PayoutMethod` type.
- `schemas.ts`: turn `addPayoutAccountSchema` into a discriminated shape — `method` selects
  BANK (needs `accountName`, `accountNumber`, `bankIdentifier`) vs UPI (needs `vpa` matching
  `handle@psp`); keep `label`, `currency`. Back-compat: absent `method` ⇒ BANK.
- `types.ts`: `PayoutAccount` DTO gains `method`, `vpa`.
- Log the shared change in `INTEGRATION_LOG.txt` (same commit). Rebuild `shared/dist`.
- Gate: `shared` tsc green. **Commit + push.**

## Phase 2 — data model (Prisma)  ☐
Files: `backend/prisma/schema.prisma`, new migration.
- `PayoutAccount`: add `method String @default("BANK")`, `vpa String?`; make
  `accountNumberMasked` and `bankIdentifier` **nullable** (UPI has neither).
- `Payment`: add `payoutRailRef String?` and `payoutMethod String?` (how the INR was
  delivered), for the FIRC + UI.
- `prisma migrate dev --create-only` (committed, **not** applied); `prisma generate`.
- Gate: `backend` tsc green (client regenerated). **Commit + push.**

## Phase 3 — the PayoutRail off-ramp port + simulated impl  ☐
Files (new): `backend/src/modules/payouts/payout-rail.interface.ts`,
`backend/src/modules/payouts/simulated-payout-rail.ts`,
`backend/src/modules/payouts/payout-rail.test.ts`; wire into app bootstrap.
- Port: `quoteOffRamp(amountMinorUsdc) → {amountMinorInr, rate, feeMinor}`,
  `execute(instruction) → {railRef, status}`, `status(railRef)`; `getPayoutRail` /
  `setPayoutRail` (mirror settlement).
- Simulated: deterministic USDC→INR at a reference rate (reuse `fx`), returns a `railRef`
  and `CREDITED`, and builds a UPI intent `upi://pay?pa=<vpa>&am=<inr>&tn=<ref>&cu=INR`.
- Unit-test the USDC(6dp)→INR(paise) scaling in one place, and the QR payload.
- Gate: `backend` tsc + vitest green. **Commit + push.**

## Phase 4 — orchestrator wiring (drive CREDITED via the off-ramp)  ☐
Files: `backend/src/modules/payouts/payout-account.service.ts`,
`backend/src/modules/payments/payment.service.ts`, payment tests.
- `payout-account.service`: accept UPI accounts (store `vpa`, skip bank masking);
  `hasActivePayoutAccount` unchanged (a UPI account already counts).
- `payment.service`: on `SETTLING → COMPLETED`, if `dstCurrency === 'INR'`, resolve the
  payee's active INR destination (UPI or bank), call `getPayoutRail().execute(...)`, store
  `payoutRailRef` + `payoutMethod`; the `CREDITED` step now reflects a real push. INSTANT
  one-request flow stays intact; HOLD unaffected.
- Tests: end-to-end payment to a **UPI** payee reaches COMPLETED with a `payoutRailRef`.
- Gate: `backend` tsc + vitest green. **Commit + push.**

## Phase 5 — compliance: PA-CB per-transaction limit rule  ☐
Files (new): `backend/src/modules/compliance/rules/pacb-limit.ts`; register in
`rules/index.ts`; test.
- New `Rule`: for an INR-destination payment, cap per-transaction value (USD-2,000 class,
  via `ctx.toMinor('USD')`); `severity` + message on breach; `legalRef` = RBI PA-CB.
  A breach becomes a normal FLAG the adjudicator triages — no special path.
- Gate: `backend` tsc + vitest green (rule count updated). **Commit + push.**

## Phase 6 — FIRC reflects the off-ramp reference  ☐
Files: `backend/src/modules/documents/document.service.ts`.
- FIRC PDF includes `payoutRailRef` + delivery method (UPI VPA masked / bank last-4) as the
  inward-remittance reference the freelancer keeps.
- Gate: `backend` tsc + vitest green. **Commit + push.**

## Phase 7 — frontend (UPI method + QR + credited)  ☐
Files: `frontend/src/pages/freelancer/PayoutAccounts.tsx`, payment-detail view, api types.
- Payout methods page: a BANK/UPI toggle; UPI shows a single "UPI ID (VPA)" field with
  `handle@psp` validation; BANK keeps today's fields.
- Payment detail: when `payoutMethod === 'UPI'`, render the UPI QR/deep-link and the
  "credited to name@psp" state; the `CREDITED` timeline row shows the destination.
- Gate: `frontend` tsc + `vite build` green. **Commit + push.**

## Phase 8 — demo wiring + docs reconcile  ☐
Files: `docs/CORRIDOR_ROADMAP.md`, `docs/CORRIDOR_V2_IMPLEMENTED.md`,
`docs/SESSION_CAPTURE_2026-09-05.md`, `docs/DEMO_SCRIPT.txt`.
- Mark the UPI leg **built** (roadmap §3/§5; capture §3 status); leave the *real* PA-CB rail
  as the remaining #13. Add the UPI-credit moment to the demo script.
- Final full verify (all three packages + `forge test` unaffected). **Commit + push.**

---

## Verification gates (run at every phase, no pnpm needed)
- shared: `cd shared && ./node_modules/.bin/tsc`
- backend: `cd backend && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run`
- frontend: `cd frontend && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vite build`
A phase is not "done" and is never pushed until its gate is green.

## Adjacent buildable item (optional, not part of the UPI leg)
- **Dispute AI triage (roadmap #1)** — mirror `agent/adjudicator.ts` for disputes
  (auto-recommend refund/dismiss + confidence, escalate the rest). Backend-contained, one
  session. Can follow Phase 8 if wanted.

## Progress log (update as phases land)
- ☐ P0 baseline · ☐ P1 shared · ☐ P2 prisma · ☐ P3 rail · ☐ P4 orchestrator ·
  ☐ P5 compliance · ☐ P6 FIRC · ☐ P7 frontend · ☐ P8 docs/demo
