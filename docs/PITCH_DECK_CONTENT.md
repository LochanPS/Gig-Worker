# Corridor — pitch deck content (SH-FIN-04)

*Ready-to-paste slide content for the presentation. One section = one slide. Keep the
numbers; they are grounded in the build. Pair with `docs/DEMO_SCRIPT.txt` for the live
walkthrough. Product name: **Corridor** (formerly GigBridge).*

---

## Slide 1 — Title
**Corridor** — Autonomous cross-border payments for the global gig economy.
Sub: Compliant, sub-1%, minutes-not-days freelancer payouts — identity, compliance, FX
and blockchain settlement handled by one autonomous agent.
Tagline: *"The intermediary, out of the intermediary."*

## Slide 2 — The problem
- A freelancer in India finishing a €500 gig for a EU company loses **8–10% to fees**
  (≈ €40–50) and waits **3–5 days** on PayPal / SWIFT wires.
- The cost is mostly **hidden FX spread**, not a visible fee.
- Cross-border compliance (KYC, AML, RBI/FEMA, sanctions) is slow, manual, and repeated
  for every payment.
- Global gig marketplaces need this at scale, per worker, every payout.

## Slide 3 — The solution
Corridor pays a freelancer across borders in **under a minute at < 1%**:
1. An **autonomous agent** verifies both parties once (reusable, on-chain-anchored credential).
2. A **deterministic engine** screens every payment against **two jurisdictions**.
3. An **FX rate is locked**; value settles over an **on-chain escrow** (EUR → USDC → INR).
4. INR lands in the freelancer's **UPI** id — the real Indian last mile.
Three roles: **Company · Freelancer · Admin/Operator.**

## Slide 4 — How it works (flow)
`Company pays €500 → compliance screen (2 jurisdictions) → FX rate-lock → fund USDC
escrow on-chain → release → USDC→INR off-ramp → ₹ credited to the freelancer's UPI id.`
- Fee **0.75%** flat (vs 8–10% hidden).
- Every step is a state in one auditable machine; every decision is hashed on-chain.
- "Complete" means **money received in INR**, not just "settled in USDC."

## Slide 5 — Decentralized identity (fraud reduction)
- Each party's wallet **is** its identifier; verification issues a **reusable credential
  anchored on-chain** (`IdentityRegistry`).
- **No personal data on-chain — only a keccak256 hash** (GDPR / DPDP / Aadhaar Act).
- Verification can be **REJECTED** (sanctions / bad doc / tax-id) with a reason + resubmit.
- Unverified parties **cannot transact** — the escrow refuses them. Verify once, reuse
  across every future payment (this is where the 3–5 days used to go).

## Slide 6 — Compliance, by design
- **Deterministic 10-rule engine**: India **RBI/FEMA**, EU **AMLD/GDPR**, US **OFAC**, plus
  velocity / structuring / outlier heuristics. Screens **every** payment vs **two** jurisdictions.
- **Rules decide; the LLM only explains** — auditors get a verdict *and* a plain-English
  rationale. The decision **hash is anchored on-chain** (`AuditAnchor`) — tamper-evident.
- **GDPR**: data minimization (hash-only), consent, purpose limitation, right-to-erasure.
- **RBI**: PA-CB per-transaction cap rule on INR payouts; e₹/UPI last mile.

## Slide 7 — On-chain escrow & settlement
- Four audited-pattern contracts (Foundry, **34 tests**): `EscrowVault`, `IdentityRegistry`,
  `MockUSDC`, `AuditAnchor`. OpenZeppelin `AccessControl` + `ReentrancyGuard`.
- **A payee can never release escrow to themselves** — only the platform/payer, or an arbiter.
- **INSTANT** (settle-through) and **HOLD** (fund now, release on work approval) modes.
- Settlement is a **port**: simulated by default, real viem on-chain under one flag — the
  orchestrator never learns the vendor. Deployable to Base Sepolia / Amoy / Sepolia with
  live **block-explorer links**.

## Slide 8 — Multi-currency + real-time FX + the India last mile
- **Multi-currency**: USDC settlement, corridors EUR↔INR and USD↔INR, live FX **rate-lock**
  with a countdown (no funding at a rate nobody agreed to).
- **UPI / e-Rupee off-ramp** (the last mile most stop short of): after on-chain release, a
  `PayoutRail` pushes **₹ to the freelancer's UPI id**, with a scannable `upi://` deep link
  and the reference on the **FIRC** (inward-remittance certificate). Simulated rail now; a
  licensed **PA-CB** partner swaps in behind the same port.

## Slide 9 — The autonomous agent (AI where it helps, rules where it must)
- **AI adjudication**: triages every compliance FLAG → AUTO_CLEAR / AUTO_REJECT / ESCALATE,
  **confidence-gated**; sanctions / structuring / high-value **always escalate**. Only real
  exceptions reach a human — the queue stays small.
- **AI dispute triage**: recommends REFUND / DISMISS / ESCALATE on disputes; auto-resolves
  the confident, low-risk cases, escalates fraud/legal + high-value.
- LLM **or** deterministic heuristic — never blocked on the network; no API key required.

## Slide 10 — Architecture / tech
- **Frontend**: React + Vite SPA — Company, Freelancer, Admin dashboards.
- **Backend**: Fastify + Prisma + Postgres — 19 modules, 60 routes, autonomous agent, rule
  engine. **133 backend tests green.**
- **Contracts**: Solidity + Foundry (34 tests), viem settlement adapter, event listener.
- **Shared**: one typed contract (enums, Zod schemas, DTOs) both ends import.
- On-chain: PII off-chain (hashes only); decisions + settlement engraved on-chain.

## Slide 11 — Live demo (what the judges will see)
1. Company posts a €500 payout to a verified freelancer — live quote, "PayPal €44 vs
   Corridor €3.75."
2. Compliance rules tick live; the agent streams its reasoning; escrow funds **on-chain**
   (tx hash → explorer).
3. Freelancer's timeline updates live → **₹ credited to `priya@okhdfc`** with a UPI QR /
   deep link; FIRC carries the reference.
4. "The agent says no": a sanctioned payee is **rejected instantly** (OFAC); a €12k payment
   is **flagged** → admin approves with a note.
5. Dispute → arbiter/AI triage decides **from escrow, before release** — released is final.
Total happy-path time: **~50 seconds.**

## Slide 12 — Problem-statement coverage (SH-FIN-04)
| Requirement | Delivered |
|---|---|
| Smart contracts, low-fee remittance | `EscrowVault` milestone/settlement, 0.75%, L2-ready |
| Multi-currency wallet + real-time conversion | USDC + EUR/USD/INR corridors + FX rate-lock |
| Compliance (GDPR + RBI) | 10-rule engine, hash-only PII, e₹/UPI, PA-CB cap |
| Decentralized identity, fraud reduction | on-chain-anchored credential gating every payment |

## Slide 13 — Why Corridor wins
- **Full loop, not a slice**: EUR in → on-chain USDC → **₹ in a real UPI id**. Most demos
  stop at "settled in USDC."
- **Compliance + identity are first-class**, enforced live, not slideware.
- **Rules decide, AI explains** — auditable by design; regulators get both.
- **Real testnet + explorer proof**, and an honest production path (partners, licensing).

## Slide 14 — Business model
- Transparent **0.75% flat** vs incumbents' hidden 8–10% FX spread.
- Revenue: volume + premium company plans + compliance-report add-ons.
- Every new corridor is a **rule pack, not a rebuild**.

## Slide 15 — Roadmap to real money (honest)
- **Built**: contracts + escrow, identity, compliance + AI adjudication + dispute triage,
  FX, UPI/e₹ off-ramp (simulated), public-testnet wiring, hosted deploy.
- **Next (partners/licensing — the real critical path)**: licensed **PA-CB / AD-bank** rail,
  real **USDC + custody** (Circle/Fireblocks), KYC vendor (Signzy/Sumsub), sanctions feed,
  executable FX, **smart-contract security audit**, EU/India licensing.

## Slide 16 — Close / ask
"Same company. Same freelancer. Same payment. **50 seconds and 99% of her money —
instead of 5 days and 90%.**"
Repo: `github.com/LochanPS/Gig-Worker`. (Add team names + contact.)

---

## Key stats to sprinkle (all grounded in the build)
- Fee **0.75%** vs **8–10%** incumbent · **~50s** vs **3–5 days**.
- **4** smart contracts, **34** contract tests · **133** backend tests · **19** backend
  modules, **60** routes.
- **10-rule** compliance engine across **3** jurisdictions (India / EU / US).
- Corridors: **EUR↔INR, USD↔INR**. PII **never** on-chain (hash only).

## Prepared Q&A (from the demo script)
- **Legal without a license?** Demo simulates the fiat edges; production is partner-first
  (AD-bank / PA-CB in India, EMI in EU) — we are the tech + compliance layer, the licensed
  partner holds the rail.
- **Why blockchain?** Escrow without trusting us, minutes-not-days settlement, and a
  tamper-evident audit trail regulators can verify independently.
- **What does the AI actually decide?** Nothing alone — deterministic rules produce the
  verdict; the LLM explains and triages. That's what keeps it auditable.
