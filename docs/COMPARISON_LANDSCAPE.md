# Corridor — Comparative Landscape & Literature Review

*Who else is solving cross-border freelancer payments, what the research says about the
problem, and where Corridor actually sits. Written to serve two purposes at once: a
competitive landscape for the pitch, and the literature-review chapter of the report.*

**Version 1.0 · compiled 2026-09-05 · companion to `docs/PRD.txt`, `docs/GO_LIVE_PLAN.md` §9,
`docs/PITCH_DECK_CONTENT.md`**

---

## 0. How to read this document

Sections 1–3 are the **literature review** proper: the problem as the institutional and
academic record describes it, the method used to assemble the evidence, and a thematic
synthesis. Sections 4–6 are the **competitive landscape**: a taxonomy of players, a
comparison matrix, and a gap analysis. Section 7 states Corridor's position and, more
importantly, the claims in our own pitch that this research does *not* support.

A note on why this ordering matters academically: a literature review is not a list of
competitors with a paragraph each. It is an argument that a gap exists. So the taxonomy
(§4) is built to be *exhaustive over the solution space*, not just over the companies we
happen to admire — that is what licenses the gap claim in §6.

### 0.1 Source grading

Not all evidence here is equal, and a review that pretends otherwise is not a review.
Every citation is graded:

| Tier | Meaning | Treat as |
|---|---|---|
| **A** | Regulators, central banks, multilateral bodies, peer-reviewed or preprint academic work (BIS, CPMI, FSB, World Bank, RBI, arXiv, ScienceDirect) | Load-bearing. Safe to quote as fact. |
| **B** | Reputable trade press and law-firm client notes (Business Standard, Inc42, IBS Intelligence, Trilegal, PwC) | Reliable for events and dates; check numbers. |
| **C** | Vendor blogs, platform comparison sites, competitor-run "vs" pages | **Partisan.** Directionally useful for pricing, never load-bearing. Every Tier-C fee figure below is a vendor's account of a rival's pricing and is marked as such. |

The pricing numbers in §4 are mostly Tier C, because *nobody publishes their real all-in FX
spread* — which is itself one of the findings (§3.1). Where a Tier-C number is central to
our own pitch, §7.2 flags it as a live risk.

---

## 1. The problem as the institutional record states it

### 1.1 Cost

The World Bank's *Remittance Prices Worldwide* is the canonical price series. In **Q3 2025**
the average cost of sending $200 to G20 receiving markets was **5.68%**, split between
**4.59% for digital** and **7.30% for non-digital** channels — down 3.31 points from 9.67%
in Q1 2009 [A]. The G8/G20 "5x5" objective and the UN SDG target 10.c set **3% by 2030** as
the goal [A]. Banks remain the most expensive channel at an average **12.66%**, against a
global all-channel average of 6.35% in Q1 2024 [A/C].

**This immediately qualifies our own pitch.** Corridor's deck asserts an "8–10% incumbent
cost" (`PITCH_DECK_CONTENT.md` slides 2, 4, 15). That figure is defensible **only** for
consumer rails — PayPal to an Indian freelancer plausibly lands at 6–8% all-in [C] — and is
**not** defensible against the best-in-class incumbent. See §7.2; this is the single most
likely place a judge or examiner draws blood.

### 1.2 Speed and the friction taxonomy

The CPMI/FSB **G20 Roadmap for Enhancing Cross-border Payments** frames the problem as a set
of named frictions rather than a single cost number: fragmented data standards, complex
compliance checks, limited operating hours, long transaction chains, and weak competition
[A]. As of the 2025 monitoring survey the Roadmap's priority actions are "largely completed"
and the work now provides a global framework rather than an open agenda [A].

Two public-sector programmes matter to us as *substitutes*, not just background:

- **Project Nexus** (BIS Innovation Hub) standardises how domestic instant-payment systems
  interconnect, targeting sender-to-recipient delivery **within 60 seconds**. The Nexus
  Scheme Organisation (NSO) has been established to move toward live implementation [A].
- **Project mBridge** (China, Hong Kong, Thailand, UAE, Saudi Arabia) reached multi-CBDC MVP
  in 2024 for instant cross-border payment and FX in CBDC tokens [A].

If Nexus links UPI to SEPA-adjacent instant rails at public-utility pricing, the *speed*
half of Corridor's value proposition is commoditised by a central bank consortium. This is
the most under-discussed strategic risk in our documents and is treated properly in §6.4.

### 1.3 The India corridor specifically

India is the destination leg of every Corridor demo, so its regulatory shape is not
background — it is the product surface.

- The RBI's **Payment Aggregator – Cross Border (PA-CB)** framework (circular of
  **31 October 2023**) replaced the older OPGSP regime [A/B].
- Per-unit cap of **₹25 lakh** per cross-border transaction for goods and services [A/B] —
  a substantial liberalisation, roughly **12.5×** the old $2,000 OPGSP import limit and
  **3×** the previous $10,000 export ceiling [B/C].
- Transactions above **₹2.5 lakh** attract **enhanced due diligence** on the buyer [A/B].
- Export PA-CBs must maintain per-currency **export collection accounts with an AD Category-I
  bank** [A/B].

Corridor already implements the ₹25 lakh per-transaction cap as a compliance rule
(`compliance/rules`, added in the UPI leg, phase 5) and issues a FIRC-equivalent document.
That is genuine alignment with the live regime — and it is worth saying in the report that
the rule was implemented *from* the regulation, not retrofitted to it.

**Market size.** India's freelancer market is estimated at roughly **$25bn by 2026**, with
the gig workforce passing **10 million** workers [C]; the India freelance-platforms segment
was ~$265m in 2025 growing at ~25% CAGR [C]. For context, India's services exports reached
**$418bn in FY26** (+8% YoY), with software services around 40% of that [B/C]. The
freelancer slice is small relative to IT-services exports but is the fastest-growing and the
worst-served by existing rails.

---

## 2. Method

A literature review needs a stated method, so here is ours, honestly described.

**Search strategy.** Structured web search across four evidence classes, conducted
2026-09-05: (i) institutional/regulatory primary sources (BIS, CPMI, FSB, World Bank, RBI,
OCC/FinCEN, ESMA); (ii) academic work on stablecoin remittance economics, blockchain e-KYC,
and explainable AI in AML (arXiv, ScienceDirect, SSRN, ResearchGate); (iii) trade press for
corporate events, licences and acquisitions; (iv) vendor and comparison-site material for
pricing, which is the only place all-in pricing is stated at all.

**Inclusion criteria.** A player is in scope if it moves value from a *paying entity in one
jurisdiction* to an *individual service provider in another* and touches at least one of:
identity/KYC, compliance screening, FX, settlement, or last-mile fiat delivery. This
deliberately includes infrastructure vendors who never face the freelancer — because they
are who a competitor *builds on*, and therefore who sets the floor on achievable cost.

**Exclusion criteria.** Pure job-matching marketplaces with no payment layer; domestic-only
payroll; consumer P2P remittance to family (different regulatory purpose codes, different
product); custody and wallet vendors with no payout path.

**Limitations — stated up front.**
1. **Pricing opacity.** No participant publishes its all-in effective take rate including FX
   spread. Every comparative fee figure here is reconstructed from vendor claims about
   rivals and should carry an error bar of roughly ±1 percentage point.
2. **Partisan sources.** Several fee comparisons come from direct competitors of the company
   being described (e.g. Skydo and xFlow writing about Payoneer). Marked [C] throughout.
3. **Recency churn.** This sector consolidates fast — Bridge→Stripe, Bitwage→Paystand — so
   the taxonomy in §4 is a snapshot with a short half-life.
4. **No primary data.** We ran no user interviews and no live corridor price test. Every
   claim about what freelancers experience is second-hand. §7.3 proposes the primary study
   that would fix this.

---

## 3. Thematic synthesis of the literature

Five themes recur across the institutional, academic and industry record. Each maps to a
component Corridor actually built, which is how the review connects to the artefact.

### 3.1 Theme A — Cost is an *opacity* problem before it is a *rate* problem

The literature consistently finds that headline fees understate true cost because the
margin sits in the FX spread rather than a disclosed line item. Reconstructed all-in costs
for an Indian freelancer receiving foreign payment [C, partisan]:

| Channel | Disclosed fee | FX markup | Reconstructed all-in |
|---|---|---|---|
| PayPal | up to ~4.4% + fixed | up to ~4% | **~6–8%** |
| Payoneer | ~1% (ACH) | ~2–3% on INR withdrawal | **~3–4%** |
| Wise | from ~1.16% | mid-market, ~1.6–1.8% conversion + 18% GST + eFIRC | **~2–2.3%** |

On a $1,000 invoice this is roughly $19–21.50 (Wise), $20–30 (Payoneer), $74–90 (PayPal) [C].

The academic literature reaches the same structural conclusion from the other direction:
stablecoin rails reduce cost chiefly by **removing intermediaries** — each of whom prices
processing, FX and liquidity provisioning — with savings concentrated in exactly the
low-value corridors serving low-income populations. Reported effects include ~30% reductions
in transaction time and material fee reduction, but the same work stresses that
interoperability, risk management and regulatory fragmentation gate the benefit at scale
[A]. A recurring note in this literature is that **empirical research on actual adoption
remains sparse** [A] — which is a genuine, citable gap our report can position against.

> **Implication for Corridor.** Our real differentiator is not "cheaper than 8–10%." It is
> *disclosed* pricing: a flat 0.75% at mid-market, shown before the user commits. Against
> PayPal that is a 10× cost story. Against Wise it is a ~3× story plus a transparency story.
> Both are good. Only one of them is the story currently in our deck.

### 3.2 Theme B — Settlement speed is being solved by several parties at once

Stablecoin settlement is no longer a differentiator; it is becoming table stakes supplied by
vendors. The 2025–26 record:

- **Stripe acquired Bridge** (2024, ~$1.1bn), whose API abstracts USDC/USDT/PYUSD behind one
  balance with on-ramp, custody, conversion and fiat payout via ACH/SEPA/SWIFT, with
  KYC/KYB and Travel Rule handling built in [B/C].
- **Circle launched CPN Managed Payments** (8 April 2026) letting PSPs and banks settle in
  USDC *without holding crypto* [B].
- **Nium + Circle** (27 May 2026) pair USDC settlement with last-mile payouts in 190+
  countries [B].
- **Thunes** exposed pay-to-stablecoin-wallet payouts to the **11,500 institutions** on
  SWIFT, reaching 500m+ wallets [B].
- **Visa** piloted stablecoin pre-funding on Visa Direct for cross-border payouts (April
  2026); **Mastercard** partnered with Rain on stablecoin card settlement (May 2026) [B/C].
- **CCTP** makes native cross-chain USDC movement free at protocol level (gas only),
  permissionless [C].

Meanwhile the public sector is attacking the same latency from the fiat side via Nexus and
mBridge (§1.2) [A].

> **Implication for Corridor.** `GO_LIVE_PLAN.md` §9 already says "the chain is commoditized
> — nobody wins on 'we use blockchain'." This research confirms it emphatically and dates it.
> By 2026 a competitor can rent our entire settlement layer from Bridge or Circle in a
> sprint. Our on-chain escrow is a *correct engineering choice*, not a moat.

### 3.3 Theme C — Compliance automation is the contested ground, and explainability is the condition

This is the most encouraging theme for our thesis. The AML literature converges on a
specific, well-documented failure: an estimated **95–98% of alerts are false positives**
handled manually, while only ~5% of laundering cases reach authorities [C, but widely
replicated]. AI/ML anomaly detection is the proposed remedy — and **FATF's June 2025
guidance explicitly encourages** these tools as a way to flag risk without excessive false
positives, **with explainability as the attached condition** [A/C].

The academic work is sharper still. The dominant 2025–26 supervisory issue is the **"black
box" problem**: a model that flags a transaction must be able to show *why* [C], and the
xAI-in-transaction-monitoring literature frames the core tension as balancing
interpretability against false-positive reduction [A]. Documented obstacles: severe class
imbalance (confirmed laundering is <1% of transactions), data governance, bias from
under-representative training data, and model validation burden [A/C].

> **Implication for Corridor.** Our architecture is unusually well-aligned here, and the
> report should say so explicitly. The compliance engine is a **deterministic rule engine**
> (`compliance/rules`) — every decision is a named, inspectable rule with a jurisdiction
> attached — while the **LLM is scoped to dispute triage and adjudication assistance**
> (`AI_ADJUDICATION_AND_OPERATIONS.md`), not to the accept/reject decision on money movement.
> That is precisely the split FATF's explainability condition implies. It was a hackathon
> pragmatism choice; the literature makes it a defensible design position. **Claim this.**

### 3.4 Theme D — Reusable identity is real, and the GDPR tension has a known correct answer

The verifiable-credentials literature reports onboarding cost reductions of **30–50%** for
reusable credentials versus document-scan KYC, with repeat-verification cost reduction up to
**60%** [C, citing World Bank / Mordor]. The EU's **eIDAS 2.0** mandates member-state
issuance of a European Digital Identity Wallet and requires key regulated sectors to accept
it, putting VC-based identity on European compliance roadmaps [A/C].

On the immutability-versus-erasure conflict, the literature has largely settled: **no
personal data belongs on an immutable ledger**, and the industry standard is
**off-chain storage with on-chain hashing**, optionally with zero-knowledge proofs so a user
proves eligibility without revealing the credential [A/C]. Smart contracts then gate
transfers to verified addresses without creating a public honeypot of PII [C].

> **Implication for Corridor.** This is a direct, independent validation of what
> `IdentityRegistry.sol` already does: store a **keccak256 hash of the credential, never the
> name, PAN or Aadhaar**, and gate the escrow on `isVerified`. The report can cite the
> literature and then show the contract. That is the strongest "our design matches the
> research consensus" moment available to us — stronger than anything on the settlement side.

### 3.5 Theme E — The last mile and the licence are where these ventures actually die

Every strand of the evidence points at the same failure mode. `GO_LIVE_PLAN.md` §9 states it
as folklore ("off-ramp to local fiat is where these startups die"); the record supports it
with specifics. The players who succeeded in the India corridor did so by obtaining
**RBI PA-CB authorisation** (§4.2) — a 15-month process in Skydo's case, from in-principle
clearance in October 2024 to final licence [B]. The infrastructure vendors succeeded by
**partnering into existing last-mile networks** (Circle→Nium's 190 countries;
Thunes→SWIFT's 11,500 institutions) rather than building them [B].

> **Implication for Corridor.** Our UPI off-ramp is *simulated* (`PayoutRail` port with a
> simulated rail, UPI leg phases 3–4). The port abstraction is the right shape — it is
> exactly where a licensed partner plugs in — but the report must not overstate it. This is
> the honest boundary of the artefact, and stating it plainly is worth more marks than
> blurring it.

---

## 4. The competitive landscape: a taxonomy

Seven categories, ordered from furthest-from-us to closest-to-us.

### 4.1 Category 1 — Legacy consumer remittance and wallets

**Players:** PayPal, Western Union, MoneyGram, traditional correspondent-bank wire, Wise,
Revolut Business.

The incumbents our PRD names. They are genuinely expensive at the consumer end (PayPal
~6–8% all-in to India [C]) and genuinely slow via correspondent banking (3–5 days). But
**Wise is the important entry in this row and the one our deck ignores**: mid-market rate,
disclosed fees, ~2–2.3% all-in to India including eFIRC [C]. Wise is not a strawman. It is
a well-run competitor that has already solved transparency, and it is the benchmark a
serious examiner will hold us to.

*Threat level: **high for credibility**, low for product.* They will not build our compliance
agent, but Wise's existence caps how dramatic our cost claim can honestly be.

### 4.2 Category 2 — India-inbound freelancer collections (the closest direct competitors)

**Players:** Skydo, Karbon, Cashfree Payments, Winvesta, xFlow, Payoneer (India),
Amazon Pay (PA-CB), Adyen India.

This is the category Corridor is actually competing in, and the one our existing docs
never enumerate.

- **Skydo** — Bengaluru; serves **30,000+ Indian MSMEs, freelancers and startups** across
  50+ cities; collections in **32+ currencies**; ~12,000 exporters and **$250m+ in annual
  export payments**; secured **final RBI PA-CB authorisation** after a 15-month process
  beginning October 2024 [B]. This is the single closest competitor to Corridor's stated
  product and market.
- **Cashfree Payments**, **Amazon Pay** and **Adyen India** also hold PA-CB licences [B].
- **Payoneer** — the default because marketplace payouts land there; ~3–4% all-in on INR
  withdrawal, with the FX markup, not the 1% fee, being the real cost [C].

*Threat level: **highest**.* Skydo has the regulatory asset we do not have and cannot build
in a hackathon. What it does not appear to have is dual-jurisdiction automated compliance
reasoning, a reusable identity credential, or an on-chain audit trail. That is the honest
shape of the contest.

### 4.3 Category 3 — Global contractor management and EOR (workflow owners)

**Players:** Deel, Remote.com, Papaya Global, Rippling, Multiplier, Oyster, Wisemonk.

These win by owning the *workflow* — contracts, onboarding, invoices, approvals, compliance
documents — with payment as the sticky last step. Pricing: Deel global/US payroll from
**$29/employee/month**, EOR from **$599** (Standard) / **$899** (Enterprise); Papaya payroll
**$29**, EOR from **$499** [B/C]. Papaya claims flat transaction fees, 130+ currencies and
95% of payments delivered instantly or same-day [C]. Deel draws recurring criticism for
**withdrawal-fee opacity** at the contractor's cash-out step [C] — a live wedge for a
transparent-pricing entrant.

*Threat level: high, structurally.* `GO_LIVE_PLAN.md` §9 already internalises the lesson
("own the workflow, not just the transfer"). Corridor's invoices → approvals → pay-run →
schedules chain is the correct response and is genuinely built.

### 4.4 Category 4 — Marketplaces with embedded payouts

**Players:** Upwork, Fiverr, Freelancer.com, Guru, Toptal.

Upwork charges a variable **0–15%** service fee per contract since 1 May 2025 (most report
~10%), plus withdrawal fees of $0–30 and conversion charges; Fiverr charges a flat **20%**
seller fee with withdrawal $0–3 and a 14-day hold [C]. On $3,000 gross that is $2,700 versus
$2,400 take-home before withdrawal costs [C].

*Threat level: low but instructive.* Our PRD's non-goal ("not a marketplace") is correct —
but note that a marketplace's 10–20% take rate dwarfs any payment rail's 2–8%, which means
**for marketplace-sourced work, the payment fee is not the freelancer's main problem.** Our
target user must be the freelancer with a *direct* client relationship. Our PRD's Priya
persona is right; the report should make the reasoning explicit.

### 4.5 Category 5 — Crypto-native contractor payroll

**Players:** Request Finance, Rise (Riseworks), Toku, Bitwage (acquired by **Paystand**,
November 2025), plus newer entrants.

- **Request Finance** — invoice-driven contributor payments, native multi-sig,
  **non-custodial**, 350+ tokens; the default for decentralised teams; no W-2 by default [C].
- **Rise** — supports **W-2 issuance** for US employers; USDC, USDT and volatile assets [C].
- **Toku** — token-grant payroll for crypto-native employers, added stablecoin cash payroll
  in 2023; handles grant accounting others do not [C].
- **Bitwage** — founded 2014, Bitcoin-first, pivoted to USDC/USDT, **acquired by Paystand**
  November 2025 and folded into enterprise AR/AP [C].

*Threat level: moderate.* These are the closest technical analogues to Corridor's settlement
leg. Critically, their centre of gravity is the **crypto-native employer paying a
crypto-comfortable worker**. Corridor's premise is the opposite: a Berlin GmbH and a
Bengaluru freelancer who both want EUR in and INR out and never want to see a wallet. That
positioning difference is real and defensible.

### 4.6 Category 6 — Stablecoin settlement infrastructure (suppliers, not rivals)

**Players:** Circle (USDC, CCTP, CPN / CPN Managed Payments), Bridge (Stripe), Nium, Thunes,
Zerohash, Fireblocks, BlindPay, Conduit.

Covered in §3.2. The key structural fact: **these are who we would buy from, and also who
our competitors buy from.** Their existence means the settlement layer is a purchased
commodity for everyone. Our roadmap items #15 (real USDC + custody via Circle/Fireblocks)
and the fiat on/off-ramp partner list in `GO_LIVE_PLAN.md` §9 already assume this.

*Threat level: low as rivals, high as commoditisers.*

### 4.7 Category 7 — Public-sector rails (the sleeping substitute)

**Players/programmes:** BIS Project Nexus (NSO established), Project mBridge, UPI
international linkages, SEPA Instant.

Not companies, and therefore absent from every competitive analysis written by a startup —
which is exactly why it belongs here. Nexus targets **60-second** sender-to-recipient
delivery by standardising instant-payment-system interconnection [A]. If it lands on the
EU↔India corridor at utility pricing, the speed argument evaporates and the cost argument
compresses hard.

*Threat level: low near-term, existential long-term.* Note that Nexus solves **transport**.
It does not solve dual-jurisdiction compliance determination, reusable identity, or the
freelancer's tax-documentation problem — which is the argument for why Corridor's value
would survive it.

---

## 5. Comparison matrix

Dimensions chosen because they are the axes on which Corridor claims to differ. Cost figures
are reconstructed all-in for an India-inbound service payment and carry ±1pp error [C].

| | All-in cost | Speed | Dual-juris. compliance engine | Reusable identity | Pricing disclosed | On-chain audit trail | Last-mile INR | Licensed |
|---|---|---|---|---|---|---|---|---|
| **PayPal** | ~6–8% | 1–3 d | manual/internal | no | ✗ hidden FX | ✗ | yes | yes |
| **Wise** | ~2–2.3% | mins–1 d | internal | no | ✓ mid-market | ✗ | yes | yes |
| **Payoneer** | ~3–4% | 1–3 d | internal | partial (once per Payoneer) | ✗ FX markup | ✗ | yes | yes |
| **Skydo** | ~1–2% claimed | ~1 d | internal, India-side | no | ✓ flat-fee model | ✗ | yes | **✓ PA-CB** |
| **Deel** | fee + FX, opaque at cash-out | 1–3 d | EOR/contract layer | per-platform | ✗ withdrawal fees | ✗ | yes | yes |
| **Upwork / Fiverr** | 10% / 20% take + withdrawal | days + hold | n/a | no | ✓ take rate | ✗ | yes | yes |
| **Request Finance** | gas + spread | mins | ✗ | wallet-based | ✓ | ✓ (chain) | ✗ (user off-ramps) | non-custodial |
| **Rise / Toku** | subscription + FX | mins–1 d | US-centric payroll tax | partial | partial | ✓ (chain) | limited | varies |
| **Circle / Bridge / Nium** | infra pricing | secs–mins | KYB/Travel Rule as infra | ✗ | ✓ to partners | ✓ | via partners | yes |
| **Project Nexus** | utility (TBD) | **60 s** | ✗ (transport only) | ✗ | ✓ | ✗ | national IPS | central banks |
| **Corridor** | **0.75% flat** | **~50 s demo** | **✓ 10-rule, both sides** | **✓ hash-anchored VC** | **✓ pre-commit** | **✓ AuditAnchor** | **simulated** | **✗ partner-dependent** |

Read the last row honestly: Corridor is the only entry with ticks in the compliance,
identity and audit columns **simultaneously**, and one of only two entries with an ✗ in the
licensing column. That is the trade the whole venture makes.

---

## 6. Gap analysis — where the whitespace actually is

### 6.1 What is already crowded

Settlement speed (§3.2), stablecoin rails (§4.6), workflow ownership (§4.3), and India
collections with a licence (§4.2) all have well-capitalised, licensed occupants. Any claim
resting on "we settle on-chain so we are fast and cheap" is, in 2026, a claim that four
vendors will sell to anyone for an API key.

### 6.2 What is genuinely unoccupied

Three gaps survive scrutiny:

1. **Automated *dual-jurisdiction* compliance determination as the product.** Every player
   in §4.1–4.5 runs compliance as internal cost, on one side of the corridor, opaque to both
   counterparties. Nobody sells the *determination itself* as an inspectable artefact —
   a per-payment, per-jurisdiction, rule-by-rule record the payer, payee and auditor can all
   read. The FATF explainability condition (§3.3) makes this the direction of regulatory
   travel, not a nicety.

2. **Verify-once identity that is portable across payers.** Payoneer and Deel verify you
   once *per platform*; the credential does not travel. The VC literature reports 30–50%
   onboarding cost reduction and up to 60% on repeat verification (§3.4), and eIDAS 2.0 is
   about to make wallet-held credentials normal in Europe — yet no freelancer-payments
   player has shipped a payer-portable credential.

3. **Pricing disclosed *before commitment*, including the FX spread.** Wise discloses; Skydo
   claims flat fees. But the combination of pre-commit rate-lock, a visible mid-market
   reference, and a single all-in number that includes the last mile is not standard.

### 6.3 Corridor's defensible position, restated

The wedge is not any single one of these. It is that **the compliance engine, the credential
and the audit anchor compound**: each new corridor's rule pack is reusable, each verified
freelancer is reusable across payers, and each decision is independently checkable. That is
the accumulating asset the PRD §8.4 gestures at, now with a literature basis under it.

### 6.4 Threats, ranked

| # | Threat | Why it bites | Mitigation available to us |
|---|---|---|---|
| 1 | **Skydo and the PA-CB holders** | Same customer, same corridor, and they have the licence | Compete on compliance transparency + portable identity, not on rails; partner rather than replicate |
| 2 | **Our cost claim is overstated** | Wise at ~2% makes "8–10%" look like a strawman | Restate honestly (§7.2). Lead with *disclosure*, not magnitude |
| 3 | **Settlement commoditisation** | Bridge/Circle/Nium sell our differentiator | Already accepted in `GO_LIVE_PLAN.md` §9; do not lead with chain |
| 4 | **Deel-style workflow lock-in** | Payment is sticky only as the end of a workflow | Our invoice→approval→pay-run chain is the right answer; keep investing there |
| 5 | **Project Nexus** | Public utility at 60s undercuts speed *and* price | Value migrates entirely to compliance + identity + documentation |
| 6 | **Regulatory whiplash** | GENIUS final rules July 2026, regime live Jan 2027; MiCA authorisation deadline 1 July 2026 | Stay non-custodial and partner-first; the rule engine is the adaptation surface |

---

## 7. Positioning, and what this research does *not* support

### 7.1 The one-paragraph position

> Corridor is not competing on blockchain settlement, which is commoditised, nor on being
> cheapest, since Wise and the licensed Indian PA-CBs are already close to the floor. It
> competes on making a cross-border freelancer payment **legible**: one automated,
> inspectable compliance determination across both jurisdictions, a verification the
> freelancer owns and reuses across every payer, and a price disclosed in full before the
> payer commits — settled on rails we rent, delivered through partners we do not intend to
> become.

### 7.2 Claims in our own documents that this research contradicts or weakens

Listed deliberately. A review that only confirms the sponsor's priors is not a review, and
an examiner who finds these before we do will discount everything else.

1. **"8–10% incumbent cost" (deck slides 2, 4, 15; `PRD.txt` §2.2b, §8.4).** Supported for
   PayPal/Western Union consumer rails and correspondent banking. **Not supported** as a
   general "incumbent" figure: World Bank puts digital remittance at 4.59% globally [A], and
   Wise reaches India at ~2–2.3% all-in [C]. *Recommended restatement:* "**8–10% on the
   consumer rails most freelancers actually default to (PayPal, bank wire) — and 2–4% even
   on the best-in-class alternatives, where the margin is still an undisclosed FX spread.**"
   This is a stronger claim, because it survives the follow-up question.

2. **"€3.75 vs €44 on €500" (slide 4).** True against PayPal. Against Wise the comparison is
   roughly €3.75 vs €10–11. Keep the PayPal comparison, label it as PayPal, and add the Wise
   row voluntarily — pre-empting the challenge reads as rigour rather than as a gap.

3. **"Verify once → reusable across every future company" (slide 5).** Architecturally true
   in our implementation, but the deck implies an industry-wide portability that requires an
   issuer network we do not have. Phrase as *designed for portability*, aligned with
   eIDAS 2.0 direction.

4. **"Complete means money received in INR" (slide 4).** Our off-ramp is a **simulated** rail
   (`PayoutRail` port, UPI leg phase 3). The port is the correct abstraction and the demo is
   honest about being a demo — but any sentence implying live INR delivery is not supportable
   and should be phrased as "the off-ramp leg is implemented against a port that a licensed
   PA-CB partner fulfils in production."

5. **"Autonomous compliance agent" as the AI framing.** Our accept/reject path is a
   deterministic rule engine, not an AI agent — and per §3.3 **that is the better story**,
   not a weaker one. Calling it an AI agent invites exactly the black-box objection FATF
   raises. Reframe: *deterministic, explainable rule engine for money-movement decisions; AI
   scoped to dispute triage and operator assistance.*

### 7.3 What primary research would strengthen the report

The sparse-empirical-adoption gap noted in §3.1 [A] is an opening. Two feasible studies:
(i) a **live corridor price audit** — send a controlled €500 EU→India payment through
PayPal, Wise, Payoneer and Skydo, recording disclosed fee, realised rate versus mid-market
at initiation, and wall-clock delivery time; (ii) a **short structured survey** of Indian
freelancers on re-verification burden and FIRC/tax-documentation friction, which is the
pain our identity and documents modules address and for which we currently cite nobody.
Either would convert this chapter from a synthesis into a contribution.

---

## 8. References

**Tier A — institutional, regulatory, academic**

- World Bank, *Remittance Prices Worldwide* (Q3 2025 main report and annex) — https://remittanceprices.worldbank.org/sites/default/files/2026-04/RPW_main_report_and_annex_Q325.pdf
- World Bank, *Remittance Prices Worldwide* data catalogue — https://datacatalog.worldbank.org/search/dataset/0037898/remittance-prices-worldwide
- UN Statistics Division, SDG indicator 10.c.1 metadata — https://unstats.un.org/sdgs/metadata/files/Metadata-10-0C-01.pdf
- FSB, *G20 Roadmap for Enhancing Cross-border Payments* — https://www.fsb.org/uploads/P091025-1.pdf
- BIS CPMI, *Enhancing cross-border payments step by step: insights from the 2025 monitoring survey*, Brief 13 — https://www.bis.org/cpmi/publ/brief13.pdf
- BIS, *Cross-border payment technologies: innovations and* …, BIS Papers No 167 — https://www.bis.org/publ/bppdf/bispap167.pdf
- BIS Innovation Hub, *Project Nexus: enabling instant cross-border payments* — https://www.bis.org/about/bisih/topics/fmis/nexus.htm
- BIS CPMI, cross-border payments programme overview — https://www.bis.org/committees/cpmi/cross-border-payments/overview
- Trilegal, *RBI's circular on Cross Border Payment Aggregators* — https://trilegal.com/wp-content/uploads/2023/12/RBIs-circular-on-cross-border-payment-aggregators.pdf
- PwC India, *Cross-border payment aggregators: regulations and business use cases* — https://www.pwc.in/industries/financial-services/fintech/payments/cross-border-payment-aggregators-regulations-and-business-use-cases.html
- *From adoption to continuance: Stablecoins in cross-border remittances and the role of digital and financial literacy*, ScienceDirect — https://www.sciencedirect.com/science/article/pii/S0736585324001345
- *SoK: Stablecoins in Retail Payments*, arXiv — https://arxiv.org/pdf/2601.00196
- Deshpande, A. V., *Enhancing Cross-Border Payment Efficiency with Stablecoins*, SSRN — https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5337435
- *Machine Learning in Transaction Monitoring: The Prospect of xAI*, arXiv — https://arxiv.org/pdf/2210.07648
- *Exploring Explainable AI in the Financial Sector: Perspectives of Banks and Supervisory Authorities*, arXiv — https://arxiv.org/pdf/2111.02244
- *Detecting Anomalous Cryptocurrency Transactions: an AML/CFT Application of Machine Learning-based Forensics*, arXiv — https://arxiv.org/pdf/2206.04803
- *Enabling Secure and Scalable GDPR-Compliant Blockchain-based e-KYC with Efficient Redaction* — https://www.researchgate.net/publication/394172552_Enabling_Secure_and_Scalable_GDPR-Compliant_Blockchain-based_e-KYC_with_Efficient_Redaction

**Tier B — trade press, law firms, corporate record**

- Inc42, *Skydo Gets RBI Licence To Offer Cross Border Payments* — https://inc42.com/buzz/skydo-gets-rbi-licence-to-offer-cross-border-payments/
- IBS Intelligence, *Skydo secures final RBI authorisation for cross-border payments* — https://ibsintelligence.com/ibsi-news/skydo-secures-final-rbi-authorisation-for-cross-border-payments/
- Business Standard, *Fintech Skydo receives in-principle approval to operate as PA-CB entity* — https://www.business-standard.com/companies/start-ups/fintech-skydo-receives-in-principle-approval-to-operate-as-pa-cb-entity-125012101362_1.html
- Business Standard, *Cashfree Payments gets payment aggregator-cross border licence from RBI* — https://www.business-standard.com/companies/start-ups/cashfree-payments-gets-payment-aggregator-cross-border-licence-from-rbi-124072201242_1.html
- Nium newsroom, *Nium & Circle partner to power USDC global payments* — https://www.nium.com/newsroom/nium-circle-usdc-settlement-global-payouts
- Thunes, *Thunes brings stablecoin payouts to 11,500 banks via Swift connectivity* — https://www.thunes.com/news/thunes-brings-stablecoin-payouts-to-11500-banks-via-swift-connectivity-bridging-traditional-finance-and-digital-assets/
- Bitcoin.com News, *Circle launches CPN Managed Payments for banks and PSPs* — https://news.bitcoin.com/circle-launches-cpn-managed-payments-for-banks-and-psps-to-settle-in-usdc-without-holding-crypto/
- Spark, *Stripe's stablecoin bet: what the Bridge acquisition means for payments* — https://www.spark.money/research/stripe-bridge-acquisition-stablecoin-payments
- IBEF, *Services industry exports from India* — https://www.ibef.org/exports/services-industry-india

**Tier C — vendor and comparison sources (partisan; pricing only)**

- Winvesta, *The real cost of PayPal for Indian freelancers in 2026* — https://www.winvesta.in/blog/businesses/the-real-cost-of-paypal-for-indian-freelancers-in-2026
- Winvesta, *₹25 lakh cap on cross-border payments: RBI PA-CB rules explained* — https://www.winvesta.in/blog/businesses/rbis-25-lakh-cap-on-cross-border-payments-what-to-know
- xFlow, *PayPal vs Payoneer vs Wise 2026* — https://www.xflowpay.com/blog/paypal-vs-payoneer-vs-wise
- xFlow, *Payoneer fees in India: the FX markup, not just the 1%* — https://www.xflowpay.com/blog/payoneer-charges
- Skydo, *PA-CB circular and OPGSP update* — https://www.skydo.com/blog/pacb-circular-and-opgsp-update
- Skydo, *Wise vs Payoneer* — https://www.skydo.com/compare/wise-vs-payoneer
- Remote.com, *Best EOR for 2026: Deel vs Rippling vs Remote vs Papaya Global* — https://remote.com/blog/eor-peo/deel-vs-rippling-vs-remote-vs-papaya-global
- Remote.com, *Global contractor management: Deel vs Rippling vs Remote vs Papaya Global* — https://remote.com/blog/contractor-management/deel-vs-rippling-vs-remote-vs-papaya-global
- Deel, *Deel vs Papaya Global comparison* — https://www.deel.com/blog/deel-vs-papaya-global-honest-employer-of-record-service-comparison/
- Request Finance, *Crypto payroll platforms compared: Bitwage, Rise, Toku…* — https://www.requestfinance.com/blog/crypto-payroll-platforms-compared
- Toku, *Rise (Riseworks) alternatives for payouts and contractor payments* — https://www.toku.com/resources/rise-alternatives-for-payouts-and-contractor-payments
- Eco, *Best crypto payroll platforms 2026, compared* — https://eco.com/support/en/articles/14799237-best-crypto-payroll-platforms-2026-compared
- Eco, *Bridge.xyz: stablecoin API for payouts and orchestration* — https://eco.com/support/en/articles/15083178-bridge-xyz-stablecoin-api-for-payouts-and-orchestration
- Eco, *Circle CPN vs stablecoin orchestration networks* — https://eco.com/support/en/articles/15182311-circle-cpn-vs-stablecoin-orchestration-networks-what-s-different-in-2026
- Jobbers, *Average platform fees across freelance marketplaces in 2026* — https://www.jobbers.io/average-platform-fees-across-50-freelance-marketplaces-in-2026/
- BestJobSearchApps, *Freelance platform fee comparison (2026 data)* — https://bestjobsearchapps.com/articles/en/freelance-platform-fee-comparison-upwork-fiverr-freelancercom-guru-and-more-2026-data
- BlindPay, *Stablecoin regulation tracker 2026: MiCA, the GENIUS Act, Brazil, Japan* — https://blindpay.com/resources/more/stablecoin-regulation-tracker-2026
- Interexy, *GENIUS Act vs MiCA: the 2026 stablecoin compliance map* — https://interexy.com/genius-act-vs-mica-the-2026-stablecoin-compliance-map-a-regulatory-deep-dive
- Security Boulevard, *Decentralized identity and verifiable credentials: the enterprise playbook 2026* — https://securityboulevard.com/2026/03/decentralized-identity-and-verifiable-credentials-the-enterprise-playbook-2026/
- Chainlink, *Blockchain GDPR compliance and institutional standards* — https://chain.link/article/blockchain-gdpr-compliance-guide
- Alessa, *How AI is improving AML software in 2026* — https://alessa.com/blog/how-ai-is-improving-aml-software-in-2026/
- Kleros, *Escrow documentation* — https://docs.kleros.io/products/escrow
- Grand View Research, *India freelance platforms market outlook 2026–2033* — https://www.grandviewresearch.com/horizon/outlook/freelance-platforms-market/india
- Razorpay Learn, *The scope and challenges of freelancers in India 2026* — https://razorpay.com/learn/scope-and-challenges-of-freelancers/

---

## 9. Where this connects to the rest of the repo

| This document | Companion |
|---|---|
| §1.3 India regulatory shape | `compliance/rules` (₹25 lakh PA-CB cap), `docs/GO_LIVE_PLAN.md` §8 |
| §3.3 explainability | `docs/AI_ADJUDICATION_AND_OPERATIONS.md`, `compliance/rules/index.ts` |
| §3.4 hash-not-PII identity | `contracts/IdentityRegistry.sol`, deck slide 5 |
| §3.5 last-mile honesty | `PayoutRail` port, UPI leg phases 3–4, `docs/EXECUTION_PLAN_UPI_LEG.md` |
| §6.4 threats | `docs/GO_LIVE_PLAN.md` §9 (competitive lessons) |
| §7.2 claim corrections | `docs/PITCH_DECK_CONTENT.md` slides 2, 4, 5, 15; `docs/PRD.txt` §2.2, §4.2, §8.4 |
