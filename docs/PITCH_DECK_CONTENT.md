# Corridor — pitch deck content (SH-FIN-04)

*Deep, build-grounded content for the presentation. Each `## Slide` gives you: a headline,
a subtitle, the on-slide bullets, a "What we actually built" block (the substance behind the
claim), speaker notes, and the numbers to show. Everything here is real and in the repo —
pair with `docs/DEMO_SCRIPT.txt` for the live walkthrough and `docs/CORRIDOR_V2_IMPLEMENTED.md`
for the exact code map. Product name: **Corridor** (formerly GigBridge).*

---

## Slide 1 — Title

**Corridor** — Autonomous cross-border payments for the global gig economy.

Subtitle: *Compliant, sub-1%, minutes-not-days freelancer payouts — one autonomous agent
handles identity, compliance, FX and blockchain settlement end to end.*

On-slide: product name + logo, one-line tagline **"The intermediary, out of the intermediary."**,
the corridor it runs (EU / US → India), and "Built for SH-FIN-04: Blockchain-Enabled
Cross-Border Financial Tools."

Speaker notes: open with the human, not the tech — "This is about a freelancer getting paid
what she earned, in minutes, not losing a tenth of it to middlemen over five days." Say the
category in one breath: identity + compliance + FX + on-chain settlement, automated.

---

## Slide 2 — The problem (make them feel the tax)

Subtitle: *Getting paid across borders is slow, opaque, and expensive — and the cost lands
on the person who can least afford it.*

On-slide bullets:
- A freelancer in Bengaluru finishes a **€500** gig for a company in Berlin. Paid via
  PayPal / a bank wire she loses **8–10% (~€40–50)** and waits **3–5 days**.
- The cost is mostly a **hidden FX spread**, not a line-item fee — she never sees where it went.
- Every payment re-runs the same **KYC, AML, sanctions and FX** work manually, per transfer.
- Multiply by a **global gig marketplace**: thousands of payouts a day, every one a
  compliance event across **two jurisdictions**.

What we actually built (framing): the demo runs the exact scenario above — Novatek GmbH (DE)
paying Priya Sharma (IN) €500 — so the numbers on this slide are the numbers the judges see live.

Speaker notes: anchor the pain in one person and one number. "8–10% and 3–5 days" is the enemy;
everything after is how we beat it. Name the three hard parts (speed, cost, compliance) so the
solution slide can knock down each.

Numbers to show: **8–10%** incumbent cost · **€40–50** lost on a €500 gig · **3–5 days** wait.

---

## Slide 3 — The solution (what Corridor is)

Subtitle: *An autonomous cross-border payout gateway: verify once, comply automatically,
lock the rate, settle on-chain, deliver to a real bank/UPI — in under a minute, under 1%.*

On-slide bullets (the four moves):
1. **Verify once** — an agent runs KYC/KYB and issues a **reusable, on-chain-anchored
   credential**; the same freelancer never re-verifies for the next company.
2. **Comply automatically** — a deterministic engine screens **every** payment against
   **two jurisdictions** (source + destination) before any money moves.
3. **Lock the rate & settle on-chain** — FX is quoted and rate-locked; value is held in an
   **on-chain escrow** and released to the payee (EUR → USDC → INR).
4. **Deliver the last mile** — INR is pushed to the freelancer's **UPI id / bank**, with an
   inward-remittance certificate (FIRC).

Three roles, three dashboards: **Company · Freelancer · Admin/Operator.**

What we actually built: all four moves are live in the app — not slideware. Verification with
a reject+resubmit path; a 10-rule compliance engine; FX rate-lock with a countdown; a Solidity
escrow with fund/release/refund; and a USDC→INR off-ramp to a UPI id.

Speaker notes: this is the "we didn't build a slice, we built the loop" slide. Every one of the
four gets its own deep slide later; here just plant that it's one continuous automated flow.

---

## Slide 4 — How it works (the flow, end to end)

Subtitle: *One payment, one automated pipeline — every step is an auditable state, every
decision is hashed on-chain.*

On-slide (draw this as a left-to-right flow):
`Company pays €500 → Compliance screen (EU + India) → FX rate-lock → Fund USDC escrow
on-chain → Release → USDC→INR off-ramp → ₹ credited to the freelancer's UPI id.`

Under the flow:
- **Fee 0.75% flat** vs 8–10% hidden. On €500: **€3.75 vs ~€44** (PayPal).
- Backed by a real **state machine**: `DRAFT → COMPLIANCE_CHECK → RATE_LOCKED → FUNDED →
  SETTLING → COMPLETED (→ CREDITED)`, with unhappy paths (REJECTED, PAYOUT_FAILED+retry,
  DISPUTED→REVERSED, EXPIRED).
- "Complete" means **money received in INR**, not merely "settled in USDC."

What we actually built: `payments/state.ts` is the single source of legal transitions; every
public action is authorization-gated (only the paying company or an admin can confirm/release;
a payee can never move their own money). Four origination paths (single payout, invoice-approve,
batch pay-run, recurring schedule) all converge on this one machine — so compliance runs once
per payment no matter how it started.

Speaker notes: emphasise the state machine + auth gates — this is what makes it a *system*, not
a script. Point out the off-ramp step is the part most crypto demos skip.

Numbers: **0.75%** · **€3.75 vs €44** on €500 · **~50 seconds** end to end.

---

## Slide 5 — Decentralized identity (fraud reduction, done right)

Subtitle: *Your wallet is your identity; verification is a reusable, tamper-evident credential
— and no personal data ever touches the chain.*

On-slide bullets:
- Each party's **wallet address is its identifier**; on verification the platform issues a
  credential **anchored on-chain** in the `IdentityRegistry` contract.
- **Hash only, never PII** — we store a keccak256 hash of the credential, not the name, PAN,
  or Aadhaar (GDPR / India DPDP / Aadhaar Act compliant by construction).
- Verification can be **REJECTED** (sanctions hit, bad document, tax-id mismatch) with a
  reason and a **resubmit** path — a real onboarding funnel, not a happy path.
- **Unverified parties cannot transact** — the escrow contract itself refuses them
  (`isVerified` gate). Verify once → reusable across every future company (this is where the
  3–5 day re-KYC delay used to go).

What we actually built: `IdentityRegistry.sol` (`setCredential` / `revoke` / `isVerified`);
a backend verification module with KYC/KYB, the REJECTED+resubmit flow, wallet provisioning,
and an on-chain-anchored credential; a `/me/identity` credential card + certificate in the UI.
In production the KYC vendor (Signzy / IDfy / Sumsub) sits behind this seam and still only ever
returns pass/fail + a reference — we never hold the raw ID.

Speaker notes: this is the SH-FIN-04 "decentralized identity to reduce fraud" requirement,
answered literally. The fraud reduction is structural: money can't route to an unverified or
sanctioned party because the contract blocks it, not because a UI hides a button.

---

## Slide 6 — Compliance, by design (the moat)

Subtitle: *A deterministic rule engine screens every payment across two jurisdictions; the AI
explains, it never decides. Every verdict is hashed on-chain.*

On-slide bullets:
- **10-rule deterministic engine**: India **RBI/FEMA**, EU **AMLD/GDPR**, US **OFAC**, plus
  **velocity / structuring / outlier** heuristics.
- Screens **every** payment against **both** the source and destination jurisdiction.
- **Rules decide the verdict; the LLM only explains it** — auditors get a machine-checkable
  decision *and* a plain-English rationale.
- The decision's **hash is anchored on-chain** (`AuditAnchor`) at creation — tamper-evident,
  independently verifiable by a regulator.
- **GDPR controls**: data minimization (hash-only), consent before attestation, purpose
  limitation, right-to-erasure. **RBI controls**: PA-CB per-transaction cap on INR payouts,
  e₹/UPI last mile, FEMA purpose codes.

What we actually built: `compliance/rules/*` (the 10 rules with jurisdiction + legal reference
+ severity), a decision object with per-rule PASS/FAIL, `AuditAnchor.sol` for the on-chain hash,
and admin surfaces `/admin/rules` and `/admin/treasury`. Adding a new corridor is a **rule pack**,
not a rewrite.

Speaker notes: this is the differentiator vs a "crypto sends money fast" demo. The story to
sell: *auditable autonomy* — fast because it's automated, trustworthy because rules (not a
black-box model) produce the verdict and it's provable on-chain.

Numbers: **10 rules · 3 jurisdictions · decision hash on-chain.**

---

## Slide 7 — On-chain escrow & settlement (trust without trusting us)

Subtitle: *Funds sit in an audited-pattern smart contract, not our bank account — released
only on the rules, refundable, and a payee can never pay themselves.*

On-slide bullets:
- Four contracts (Foundry, **34 tests**): `EscrowVault`, `IdentityRegistry`, `MockUSDC`,
  `AuditAnchor`. Solidity 0.8, **OpenZeppelin AccessControl + ReentrancyGuard**,
  checks-effects-interactions.
- `EscrowVault.fund → release → refund/freeze`; **a payee can never release escrow to
  themselves** (role-gated) — structural protection against self-dealing.
- Two modes: **INSTANT** (settle straight through) and **HOLD** (fund at gig start, release
  when the company approves the work).
- Settlement is a **port**: **simulated by default** (runs with no chain), **real viem
  on-chain under one flag** — deployable to **Base Sepolia** with live **block-explorer links**.

What we actually built: the contracts + `real-settlement.ts` (viem) + an **event listener**
that turns on-chain settlement events into the live UI feed; `escrowId = keccak256(paymentId)`,
amounts scaled to USDC 6-decimals, compliance hash passed into `fund()` and anchored. The demo
can run entirely simulated (bulletproof) or against a **real public testnet** where every
fund/release is a transaction you can open on the explorer.

Speaker notes: answer "why blockchain at all?" here — escrow you don't have to trust us to hold,
minutes-not-days settlement, and an audit trail a regulator verifies independently. The
port design is the maturity signal: same code path, swap simulated ↔ real ↔ a licensed rail.

Numbers: **4 contracts · 34 contract tests · 2 escrow modes.**

---

## Slide 8 — Multi-currency, real-time FX & the India last mile (the part others skip)

Subtitle: *USDC as the settlement rail, live FX with a rate-lock, and the actual last mile —
₹ landing in a freelancer's UPI id, e-Rupee-ready.*

On-slide bullets:
- **Multi-currency**: USDC settlement across **EUR↔INR** and **USD↔INR** corridors.
- **Real-time FX** with a **rate-lock + countdown** — a payment can never fund at a rate
  nobody agreed to (a stale lock is swept to EXPIRED).
- **UPI / e-Rupee off-ramp** — the USDC→INR fiat last mile: after on-chain release a
  `PayoutRail` pushes **₹ to the freelancer's UPI id (a VPA)**, renders a scannable `upi://`
  deep link, and writes the reference onto the **FIRC** (Foreign Inward Remittance Certificate).
- **PA-CB per-transaction cap** rule screens INR payouts (RBI framework).

What we actually built: the `fx` module (quote + rate-lock + history), the `PayoutRail` port
with a simulated USDC→INR rail (real PA-CB partner swaps in behind it), UPI as a first-class
payout method (VPA validation, BANK/UPI toggle), a "Credited via UPI" card with the deep link,
and the FIRC PDF carrying the off-ramp reference. `mINRC` stands in for **RBI's Digital Rupee
(e₹)** for the India leg.

Speaker notes: this is the "we finished the job" slide. Most blockchain remittance demos stop at
"settled in USDC." We deliver **rupees to a real UPI id** and produce the tax document — that's
the difference between a crypto demo and a payments product.

---

## Slide 9 — The autonomous agent (AI where it helps, rules where it must)

Subtitle: *The agent triages compliance flags and disputes so humans only see genuine
exceptions — confidence-gated, with hard safety rails.*

On-slide bullets:
- **Payment adjudication**: every compliance FLAG is triaged into **AUTO_CLEAR / AUTO_REJECT /
  ESCALATE**, **confidence-gated**. Sanctions / structuring / high-value **always escalate** to
  a human — the agent can never auto-clear those.
- **Dispute triage**: opened disputes are triaged into **AUTO_REFUND / AUTO_DISMISS / ESCALATE**;
  confident, low-risk cases resolve automatically, fraud/legal + high-value always escalate.
- **Metrics**: the Operator monitor shows the share of the queue settled **without a human**,
  with each decision's confidence + rationale.
- **LLM or deterministic heuristic** — works with **no API key** (heuristic floor), so it's
  never blocked on the network, and the LLM never overrides a hard safety rule.

What we actually built: `agent/adjudicator.ts` (payment triage) and `agent/dispute-adjudicator.ts`
(dispute triage), both with a heuristic floor + optional LLM + a confidence gate; a
`GET /admin/adjudications` metrics feed. "Only exceptions reach a human" is the scaling story —
at 10k payments/day nobody can review every flag.

Speaker notes: pre-empt "is the AI making financial decisions?" — no. Deterministic rules produce
the verdict; the agent triages the grey zone and explains. That's what keeps it auditable and
regulator-friendly, and it's a real, tested code path, not a prompt.

---

## Slide 10 — Architecture & engineering (this is real)

Subtitle: *A production-shaped monorepo — typed end to end, tested, and deployable today.*

On-slide (a simple 3-tier diagram + counts):
- **Frontend**: React + Vite SPA — Company, Freelancer, Admin dashboards; live timeline over
  WebSocket; block-explorer links.
- **Backend**: Fastify + Prisma + Postgres — **19 modules, 60 routes**, the autonomous agent,
  the rule engine, the settlement + payout ports. **133 automated tests, green.**
- **Contracts**: Solidity + Foundry (**34 tests**), viem adapter, on-chain event listener.
- **Shared**: one typed contract (enums, Zod schemas, DTOs) both ends import — no drift.
- **On-chain**: PII off-chain (hashes only); compliance decisions + settlement engraved on-chain.
- **Deploy**: Dockerized backend (Railway), static frontend (Vercel), Postgres (Railway/Neon),
  public testnet (Base Sepolia).

What we actually built: a real workspace, not a prototype — CI, migrations, seed data, mock
server for offline demo, and a documented single-source-of-truth roadmap. Total automated
coverage: **133 backend + 34 contract tests**.

Speaker notes: this slide earns credibility. Say the numbers. Mention it runs fully **offline**
(simulated settlement + fallback FX + heuristic agent) so the demo never depends on the network.

Numbers: **19 modules · 60 routes · 133 backend tests · 34 contract tests · 4 contracts.**

---

## Slide 11 — Live demo (what the judges will watch)

Subtitle: *Same company, same freelancer, same payment — 50 seconds instead of 5 days.*

On-slide (the beats — keep it to what you'll click):
1. **Happy path**: Novatek pays Priya €500 → live quote ("PayPal ~€44 vs Corridor €3.75") →
   compliance rules tick + agent explains → escrow funds **on-chain (tx hash → explorer)** →
   **₹ credited to `priya@…` UPI** with a scannable QR → "you kept 99.25%". ~50s.
2. **The agent says no**: a sanctioned payee is **rejected instantly** (OFAC cited); a €12,000
   payment is **flagged** → Admin approves with a note → payment resumes.
3. **Two-way + fraud**: US→India reverse corridor; a pre-seeded **structuring** alert (3×
   €9,400 in 72h).
4. **Dispute**: raised → **arbiter/AI triage decides from escrow, before release** — released
   is final, never reversed.

What we actually built: a one-command seeded demo with the exact actors/amounts that trigger each
scenario deterministically; a `demo:reset` to re-run in seconds; a backup path (simulated settle
+ offline FX) if the venue wifi dies.

Speaker notes: rehearse the 50-second happy path cold. Say the elapsed time out loud. Open one
Etherscan link so "on-chain" is not just a word.

---

## Slide 12 — SH-FIN-04 coverage (map every requirement)

Subtitle: *Every line of the problem statement, answered with working code.*

On-slide table:
| Requirement (SH-FIN-04) | What we delivered |
|---|---|
| Smart contracts for low-fee remittance | `EscrowVault` settlement, **0.75%**, L2-ready (Base Sepolia) |
| Multi-currency wallets + real-time conversion | USDC + EUR/USD/INR corridors + FX **rate-lock** |
| Compliance with international regulations (GDPR, RBI) | **10-rule** engine, hash-only PII, e₹/UPI, PA-CB cap, decision anchored |
| Decentralized identity to reduce fraud | on-chain-anchored credential **gating every payment** |

Speaker notes: put this slide late — it's the "we didn't miss anything" checkpoint. Read each row
as "you asked for X; here it is, running."

---

## Slide 13 — Why Corridor wins (the differentiators)

Subtitle: *A payments product, not a crypto demo.*

On-slide bullets:
- **The full loop**: EUR in → on-chain USDC → **₹ in a real UPI id** + FIRC. Most stop at
  "settled in USDC."
- **Compliance + identity are first-class and enforced on-chain**, not slideware.
- **Rules decide, AI explains** — auditable by design; regulators get a verdict *and* a reason.
- **Real testnet + explorer proof**, and an **honest production path** (named partners,
  licensing timeline) — not "trust us, it'll scale."
- **New corridor = a rule pack, not a rebuild** — the architecture is built to expand.

Speaker notes: this is your closing argument before business. Contrast explicitly with the
generic entrant: "theirs sends a token fast; ours moves compliant money across a real corridor
and proves it."

---

## Slide 14 — Business model

Subtitle: *Transparent 0.75% flat, where incumbents hide 8–10%.*

On-slide bullets:
- **Revenue**: 0.75% per payment + premium company plans (batch pay-runs, retainers, priority
  support) + **compliance-report add-ons** (FIRC/audit exports).
- **Why we can**: incumbents' 8–10% is mostly **hidden FX spread we don't take**; automation
  drops the marginal cost of a compliant payment toward zero.
- **Market**: the global gig / freelance economy — hundreds of millions of cross-border
  workers, every payout a recurring transaction.
- **Expansion**: each new corridor is a rule pack + a local rail partner — compounding, not
  linear, cost.

Speaker notes: keep it tight and confident. The one-liner: "We make money by taking a small,
visible fee instead of a large, hidden one."

Numbers: **0.75% flat** vs **8–10%** hidden.

---

## Slide 15 — Roadmap to real money (be honest — it scores)

Subtitle: *What's built, and the real critical path to production.*

On-slide (two columns):
**Built & working now**
- Contracts + escrow; decentralized identity; 10-rule compliance + AI adjudication + dispute
  triage; FX rate-lock; USDC→INR **UPI/e₹ off-ramp** (simulated rail); public-testnet wiring;
  hosted deploy (Railway + Vercel).

**Next — partners & licensing (the real critical path, 6–18 months)**
- Licensed **PA-CB / AD-bank** rail (India) + **EMI/PI** cash-in (EU); real **USDC + custody**
  (Circle / Fireblocks); **KYC vendor** (Signzy/Sumsub) + **sanctions feed** (ComplyAdvantage);
  **executable FX** partner; **smart-contract security audit**; the licensing itself.

Speaker notes: judges reward teams who know what they *haven't* solved. Say plainly: "The code
is a demo on a testnet; going to real money is a licensing + partnerships problem, and here's the
exact list." This is a strength, not a weakness.

---

## Slide 16 — Close / the ask

Subtitle: *One line they remember.*

On-slide:
> "Same company. Same freelancer. Same payment. **50 seconds and 99% of her money —
> instead of 5 days and 90%.**"

Plus: team names + roles, repo `github.com/LochanPS/Gig-Worker`, live demo URL, and a one-line
ask (what you want from the judges / next step).

Speaker notes: end on the human number from slide 2, now inverted. Don't add new information —
land the plane.

---

## Appendix A — Key stats (sprinkle throughout, all grounded in the build)
- **0.75%** fee vs **8–10%** incumbent · **~50s** vs **3–5 days** · **€3.75 vs €44** on €500.
- **4** smart contracts · **34** contract tests · **133** backend tests · **19** backend
  modules · **60** routes.
- **10-rule** compliance engine across **3** jurisdictions (India / EU / US).
- Corridors **EUR↔INR, USD↔INR** · PII **never** on-chain (hash only) · runs fully **offline**.

## Appendix B — Prepared Q&A
- **Legal without a license?** The demo simulates the fiat edges. Production is partner-first —
  an AD-bank / PA-CB partner in India, an EMI in the EU hold the licensed rail; we are the
  technology + compliance layer. Long-term we license up.
- **Why blockchain at all?** Escrow you don't have to trust us to hold, minutes-not-days
  settlement, and a tamper-evident audit trail regulators can verify independently.
- **What does the AI actually decide?** Nothing alone. Deterministic rules produce the verdict;
  the LLM explains and triages the grey zone. That's what makes it auditable.
- **How is this different from Wise / PayPal?** Transparent 0.75% vs hidden 8–10%, on-chain
  escrow + audit trail, reusable decentralized identity, and compliance as code per corridor.
- **What's real vs simulated in the demo?** Real: contracts on a public testnet, the
  fund/release transactions (explorer-verifiable), the compliance engine, the agent. Simulated:
  MockUSDC stands in for real USDC, and the INR off-ramp uses a simulated rail (real PA-CB
  partner swaps in behind the same interface).

## Appendix C — Design / demo tips
- Show one **Etherscan (BaseScan) link** live — it converts skeptics.
- Keep the compliance rules **visibly ticking**; let the agent's rationale stream.
- Do the **UPI credit** moment slowly — the scannable QR to a real VPA is the memorable image.
- Have the **backup**: simulated settlement + offline FX + heuristic agent, so nothing external
  is load-bearing on stage.
