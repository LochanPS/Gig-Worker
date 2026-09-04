# GigBridge — Consolidation map

This branch/`main` deliberately holds **all the work from both development lineages
in one place**. They cannot both run as one app (they define `@gigbridge/shared`
incompatibly — `Payment` vs `PaymentDTO`), so exactly one is the live, building
app and the other is preserved in-tree, losing nothing.

## The live, building app (repo root — old lineage)
The pnpm workspace (`shared` / `backend` / `frontend` / `contracts`) is the
**old lineage**, which is the most complete: the full backend + all six
build-out features + the frontend. Verified: backend typecheck + tests green,
frontend typecheck + vite build green.

Features present in the live app:
- Core: auth, payment orchestrator + 10-rule compliance engine, FX, agent
  explainer, alerts, invoices, PDF documents, settlement seam (sim + real viem).
- Build-out: **batch pay-run**, **recurring payouts**, **self-serve verification**.
- Unhappy paths: **failing KYC/KYB**, **payout accounts** (+ `PAYOUT_FAILED`),
  **disputes & reversals** (`DISPUTED` / `REVERSED`).

## Preserved in-tree (not wired into the live build)
- `variants/p2/` — the **P2 backend + shared** rewrite (cleaner structure,
  argon2, pdfkit PDFs, real-settlement reconnect, DTO-shaped shared API). This
  was briefly `main`. Kept verbatim so none of it is lost. Source branch:
  `origin/claude/repo-audit-backend-agent-nkgtxu` (+ the P2 swap commits).
- `variants/frontend-rich/` — the **rich 18-route frontend** (full chart layer,
  design system, realtime, PDFs) built on the *old* shared API. Source branch:
  `origin/claude/frontend-full-build`. More complete UI than the live app's
  frontend, but predates the six build-out/unhappy-path features (no UI for them
  yet). `variants/` is outside the pnpm workspace globs, so it does not affect the
  live build.

## Remaining reconciliation (follow-up, needs a human call)
1. **Pick the canonical backend**: keep the live old-lineage backend, or migrate
   to the P2 backend (then re-port the six features onto its DTO contract).
2. **Adopt the rich frontend**: fold `variants/frontend-rich/` in as the app's
   frontend and add UI for the six build-out/unhappy-path features in its design
   system. This gives the best of both (rich UI + all features).
Neither is mechanical; both change the shared contract seen by consumers.

## Branch provenance (all pushed to origin — nothing is local-only)
- `feat/product-buildout`, `feat/unhappy-paths` — the six features (old lineage).
- `claude/frontend-full-build`, `claude/frontend-analysis-planning-i605iu` — rich FE.
- `claude/repo-audit-backend-agent-nkgtxu` — P2 backend.
- `claude/product-scope-roadmap-f2x0op`, `claude/*-docs` — analysis/docs.
- `backup/scaffold-local-427faa2`, `backup/track-backend-local-cfd4b51` — old
  superseded local tips, preserved.
