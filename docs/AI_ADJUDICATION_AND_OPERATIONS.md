# AI adjudication, customer management & operator dashboards

Covers the "operate the platform, don't demo it" path: the AI compliance
adjudicator, live customer management, and the v2 operator/company dashboards.

## 1. AI adjudication agent
`backend/src/modules/agent/adjudicator.ts`

The deterministic rule engine still owns the hard verdict (a BLOCK → REJECT
happens before this). This agent triages only the grey-zone **FLAG**s so a human
does not review every payment — essential at 10k/day.

- **Actions**: `AUTO_CLEAR` (→ payment returns to `COMPLIANCE_CHECK`, payer can
  confirm), `AUTO_REJECT` (→ `REJECTED`), `ESCALATE` (→ stays `FLAGGED`, human queue).
- **Confidence-gated**: an auto action applies only at ≥ 0.75 confidence, else escalate.
- **Safety floor** (never overridden, even by the LLM): sanctions/OFAC hits,
  structuring patterns, and payments above the value ceiling (USD 25k) always escalate.
- **LLM + fallback**: uses Claude when `ANTHROPIC_API_KEY` is set; otherwise a
  deterministic heuristic runs. Any error leaves the payment `FLAGGED` — it never
  auto-acts on failure.
- **Wiring**: `payment.service.createPayment` calls it in the FLAG branch; the
  outcome is written to the ComplianceDecision (`reviewedBy = ai:*`, `reviewNote`)
  and audit-logged. Env flag `AI_ADJUDICATION` (default `true`).
- **Tests**: `adjudicator.test.ts` (6) — sanctions/structuring/high-value escalate,
  lone low-severity flag auto-clears, confidence gate holds.

**Not yet**: dispute triage by AI (disputes are still resolved manually), a
persisted per-day adjudication metric, and confidence tuning against real volume.

## 2. Customer management
`backend/src/modules/customers/*`, `frontend/src/pages/Customers.tsx`

Create and manage the real parties instead of running a fixed seed.
- `GET /customers` (admin: everyone; company: payable freelancers), `GET /customers/:id`,
  `POST /customers` (admin creates either; a company creates freelancers/payees).
- `verified: true` provisions a wallet + issues an on-chain-anchored credential, so a
  created freelancer is immediately payable and shows in the New-payout directory
  (`/directory/freelancers`).
- UI: a **Customers** page (company + admin nav) — create form + party table with
  status chips and an inline Verify (admin).

## 3. Dashboards v2
- **Company Overview**: quick actions (New payout / Batch / Add customer), a
  highlighted **Needs-attention** tile (flagged / payout-failed / disputed / to-confirm),
  a live **corridor-mix** breakdown, FX sparkline, payouts table.
- **Operator monitor**: platform metrics row (24h volume, fee revenue, avg settlement,
  flagged %), an **AI-adjudication summary** (escalated-to-you / disputes / alerts /
  verified customers), then **escalations-only** review, disputes, and fraud alerts.
Frontend-only, using existing endpoints (`/admin/metrics`, `/customers`, payments,
disputes, alerts) — no schema change.

## 4. Local demo preview (no DB)
`frontend/dist/index.html` can be served with a mock so the real UI runs on canned
data. Rebuild wipes it; re-inject with the scratch `inject-mock.mjs` after a build,
then `vite preview`. A role switcher (top-right) toggles company/freelancer/admin.
This is a preview aid only — the mock is never committed (dist is gitignored). Real
data comes from the backend (see `DEPLOY_RAILWAY.md`).

## 5. What's next (ordered)
1. Dispute AI triage (mirror the payment adjudicator).
2. Persisted adjudication metrics + an audit feed on the monitor.
3. FIRC / credential-PDF buttons in the UI; a notification center.
4. Deploy (Railway + Neon) for a live, shareable URL.
