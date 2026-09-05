# Session capture & replan — 2026-09-05 (the "freelance-escrow" session → Corridor)

*Purpose: capture **everything discussed and built in the parallel session** where a
`freelance-escrow` folder was created, and **replan each item into Corridor's real
architecture** so work can continue on any device. Special care for the **UPI leg** and
anything not already in Corridor. Nothing dropped.*

**Honest provenance note (read once):** the parallel session built a standalone
`freelance-escrow` folder and then concluded it was **redundant** — Corridor already
implements the same primitives, better. The material available to this capture is that
session's **conclusions and the concepts it raised**, not a line-by-line transcript of its
code. So this document does two things and is explicit about which is which:
1. **Reconciles** every concept the session touched against where it already lives in
   Corridor (verified against the code on `main` — see `CORRIDOR_V2_IMPLEMENTED.md`).
2. **Specifies in full** the one thing Corridor genuinely lacks — the **UPI / INR
   off-ramp last mile** — as a forward design, clearly marked *proposed*, so it can be
   built without re-deriving it.

No code was ported from `freelance-escrow`; there was nothing worth porting (Corridor's
equivalents are more complete). What was worth keeping is the **thinking**, captured here.

---

## 1. TL;DR of the session
- A separate device built `freelance-escrow` with: escrow, decentralized identity (DID),
  a stablecoin, a disputes/arbiter, a UPI QR cash-out gesture, FX, and compliance.
- Cross-checked against Corridor (`LochanPS/Gig-Worker`, `main`): **all of it already
  exists in Corridor, and more completely.** The folder was abandoned as redundant.
- **Net-new insight for Corridor:** the **UPI leg** — the USDC→INR fiat last mile — is the
  one place Corridor only "gestures" (via the settlement seam + a bank-only payout model).
  Everything else is a no-op for Corridor because it's already built.

---

## 2. Reconciliation table — session concept → where it already lives in Corridor
| Session concept (freelance-escrow) | Corridor equivalent (on `main`) | Verdict |
|---|---|---|
| **Escrow** holding funds between pay and release | `EscrowVault.sol` — fund/release/refund/freeze, OZ AccessControl + ReentrancyGuard, 34 forge tests; driven via the settlement port | **Already covered, better.** Corridor adds HOLD vs INSTANT escrow modes, per-payment freeze, compliance-hash binding. |
| **Decentralized identity / DID** | `IdentityRegistry.sol` + verification module — reusable, on-chain-**anchored credential**, hash-only (no PII), REJECT + resubmit, revoke | **Covered in spirit.** *Difference to note:* Corridor anchors a **credential hash**, it is **not** a full W3C DID / DIDComm / verifiable-credential wallet. If true self-sovereign DID is ever a goal, that's a *new* decision (see §4.1). |
| **Stablecoin** | `MockUSDC.sol` (6-dec ERC-20, faucet mint); real USDC/custody is roadmap #15 | **Covered for demo.** Real Circle/Fireblocks USDC is a known future item, not a gap this session found. |
| **Disputes / arbiter** | disputes module → **freeze → REVERSED / dismiss** + refund, plus AI adjudication (`agent/adjudicator.ts`) | **Covered, better.** Corridor's dispute→freeze→reverse + confidence-gated AI triage is more sophisticated than a single-arbiter model. Dispute-specific AI triage is roadmap #1 (still open). |
| **FX** | `fx/` — quote + rate-lock + countdown; reference rate today, executable quote is roadmap #12 | **Covered.** |
| **Compliance** | deterministic **10-rule** engine (RBI/FEMA, EU AMLD/GDPR, US OFAC + velocity/structuring/outlier), decision hash anchored, LLM explains | **Covered, far better.** |
| **UPI QR cash-out** | settlement seam ends at on-chain `release()`; `PayoutAccount` is **bank-only**; INR fiat rails are roadmap #13, penny-drop #14 | **GENUINE GAP → specified in §3.** |

**Conclusion:** the only item that turns into new Corridor work is the **UPI leg**. The rest
is already done; this table exists so a future device doesn't rebuild them by mistake.

---

## 3. THE UPI LEG — full spec (✅ BUILT, 2026-09-05, phases 1–8)
> This is the USDC → INR **fiat off-ramp last mile**: how value that has settled on-chain
> actually lands in an Indian freelancer's account via UPI. It was the single most
> demo-relevant gap and is now **implemented** on `main` (simulated rail; a real PA-CB
> partner swaps in behind the same port). The forward design below is preserved as the
> spec of record; see `EXECUTION_PLAN_UPI_LEG.md` for the phase-by-phase build and
> `FEATURE_INDEX.md` §B for per-piece status. What remains is only the *real* licensed
> rail (roadmap #13).

### 3.1 Where it fits in the existing flow
Today the money movement ends here:

```
company EUR ──FX rate-lock──▶ EscrowVault.fund (USDC) ──release──▶ SETTLING ──▶ COMPLETED
                                                             │
                                                             ▼  (settled in USDC)
                                                        [ GAP: USDC → INR → UPI ]
                                                             │
                                                             ▼
                                                   freelancer receives ₹ in UPI/bank
```

The on-chain settlement port (`Settlement.release()`) returns a tx hash and the payment is
marked COMPLETED — but "complete" today means **on-chain settled in USDC**, not "INR in the
freelancer's UPI app." The UPI leg closes that gap and makes `COMPLETED` mean *money
received in INR*.

### 3.2 Design principle — mirror the settlement port with a PayoutRail port
Corridor's cleanest pattern is the **port + simulated/real swap** used for settlement. Reuse
it verbatim for the off-ramp so the orchestrator never learns about a specific vendor:

```ts
// backend/src/modules/payouts/payout-rail.interface.ts  (PROPOSED)
export interface PayoutInstruction {
  paymentId: string;
  amountMinorInr: number;      // paise, after USDC→INR conversion
  destination:                 // discriminated union
    | { kind: 'UPI'; vpa: string }                 // e.g. name@okhdfcbank
    | { kind: 'BANK'; accountNumber: string; ifsc: string };
  purposeCode: string;         // FEMA purpose code (already collected in new-payout)
  reference: string;           // our payment ref, for FIRC/eBRC
}
export interface PayoutRail {
  quoteOffRamp(amountMinorUsdc): Promise<{ amountMinorInr; rate; feeMinor }>;
  execute(i: PayoutInstruction): Promise<{ railRef: string; status: 'SENT' | 'PENDING' }>;
  status(railRef: string): Promise<'SENT' | 'CREDITED' | 'FAILED'>;
}
export const getPayoutRail: () => PayoutRail;
export const setPayoutRail: (r: PayoutRail) => void;
```

- **`simulatedPayoutRail` (default):** returns a fake UPI reference + `CREDITED`, and can
  render a **UPI QR / deep link** (`upi://pay?pa=<vpa>&am=<inr>&tn=<ref>`) for the demo — this
  is the honest home of the parallel session's "UPI QR" idea.
- **`realPayoutRail`:** a licensed **PA-CB (Payment Aggregator – Cross Border)** / AD-bank
  partner (roadmap #13). Registered via `setPayoutRail()` at boot, exactly like settlement.

### 3.3 Data-model change (small, additive)
Extend `PayoutAccount` (today bank-only) to carry a **method**:
```
PayoutAccount.method : 'BANK' | 'UPI'     // new; default 'BANK' for back-compat
PayoutAccount.vpa    : string | null      // UPI Virtual Payment Address, when method='UPI'
```
- `hasActivePayoutAccount(userId, currency)` (the existing settlement gate) is unchanged —
  a UPI account counts as an active INR destination, so a payment with a UPI payee no longer
  needs a bank account to avoid `PAYOUT_FAILED`.
- VPA validation: shape `handle@psp`, verified with a **penny-drop / VPA-validate** call
  (roadmap #14) before it's marked `active`. Store the **name returned by the PSP**, not the
  raw one typed, to catch typos/mule accounts.
- Prisma migration committed but not applied (repo convention).

### 3.4 New payment sub-states (extend the machine, don't fork it)
After `release()` succeeds, instead of jumping straight to `COMPLETED`:
```
SETTLING ──(off-ramp quote+execute)──▶ PAYOUT_SENT ──(rail webhook)──▶ COMPLETED
                     │                                    │
                     └──────────────────────────────────▶ PAYOUT_FAILED ──(retry)──▶ PAYOUT_SENT
```
- `PAYOUT_FAILED` and **retry already exist** — reuse them; the UPI leg just gives them a real
  cause (rail rejection, VPA invalid, limit breach) instead of only "no account."
- The rail's `status()` / webhook flips `PAYOUT_SENT → COMPLETED` when the PSP confirms
  `CREDITED`. Until then the freelancer UI shows "on its way to your UPI."

### 3.5 Compliance & regulatory framing (India-specific)
- **Rail:** cross-border payout to India runs under **RBI's PA-CB** framework via an
  **AD-Category-I bank** or a licensed PA-CB. This is roadmap #13/#20 and is the real
  critical path (licensing, months) — the code seam can exist long before the license does.
- **FEMA purpose code:** already collected in the polished new-payout flow — pass it straight
  into `PayoutInstruction.purposeCode`. Freelance software/services typically **P0802 /
  P1006**-class codes; the picker already labels them.
- **FIRC / eBRC:** Corridor already generates a **FIRC PDF**. On real INR credit, the FIRC/
  eBRC is the freelancer's proof of inward remittance — wire the rail's `railRef` into the
  existing FIRC document so it reflects the actual off-ramp reference.
- **Limits:** enforce per-transaction and per-PAN annual caps (PA-CB limits, currently
  USD 2,000/txn class thinking) as **compliance rules**, reusing the deterministic engine —
  a limit breach becomes a normal FLAG → adjudicator path, not a special case.
- **Data:** never store the raw bank account / full VPA beyond what the rail needs; prefer the
  rail's token + last-4, matching the existing masked-account pattern.

### 3.6 Demo vs real
- **Demo (buildable now, no license):** `simulatedPayoutRail` + UPI QR/deep-link render +
  the new `PAYOUT_SENT → COMPLETED` states + UPI as a payout method. The jury sees
  EUR → on-chain USDC → **"₹ delivered to name@okhdfcbank"** with a scannable QR. This is the
  end-to-end story the parallel session was reaching for, now attached to Corridor's real
  escrow + compliance.
- **Real:** requires a PA-CB/AD-bank partner (roadmap #13), executable FX (#12), real USDC +
  custody (#15), and the licensing critical path (#20).

### 3.7 Build order for the UPI leg (when picked up)
1. Add `PayoutRail` port + `simulatedPayoutRail` (mirror `settlement.interface.ts`).
2. Extend `PayoutAccount` (`method`, `vpa`) + `addPayoutAccountSchema` in `shared/` (log it
   in `INTEGRATION_LOG.txt`, rebuild `shared/dist`).
3. Insert `PAYOUT_SENT` between `SETTLING` and `COMPLETED`; wire retry to the rail.
4. Frontend: add "UPI ID" as a payout method on the Freelancer → Payout methods page; render
   the QR/deep-link + "on its way" state on payment detail.
5. Wire the rail `railRef` into the existing FIRC PDF.
6. Add PA-CB limit rules to the compliance engine.
7. (Real) implement `realPayoutRail` against the chosen PA-CB partner; `setPayoutRail()` at
   boot. Orchestrator unchanged.

---

## 4. Other session ideas worth recording (not gaps, but decisions)
### 4.1 Full DID / self-sovereign identity (vs credential-hash)
Corridor anchors a **credential hash** in `IdentityRegistry` — enough for "is this party
verified?" without holding PII. The session's "DID" framing implies **W3C DIDs / verifiable
credentials / a holder wallet**. That is a **product decision**, not a bug: it would let a
freelancer carry their verification off-platform. Park it as a future option; the current
hash-anchor is the right call for a demo and for GDPR/DPDP minimization.

### 4.2 Single arbiter (vs dispute → freeze → reverse + AI)
The session's simple arbiter is strictly weaker than Corridor's dispute pipeline. No action —
recorded so nobody "adds an arbiter" thinking it's missing. The open, *worth-building* piece
is **dispute AI triage** (roadmap #1), which mirrors the payment adjudicator for disputes.

### 4.3 UPI QR as a first-class artifact
The QR/deep-link isn't just a demo prop — captured in §3.2/§3.6 as the concrete render of the
off-ramp instruction. Keep it in the simulated rail so it survives into the real one as a
fallback "pay to this VPA" affordance.

---

## 5. Continue-on-another-device checklist
1. Read `docs/CORRIDOR_ROADMAP.md` (source of truth), then `CORRIDOR_V2_IMPLEMENTED.md`
   (detailed as-built), then this file (session + UPI leg).
2. **Do not rebuild** anything in §2's table — it already exists on `main`.
3. If picking up the demo story, build the **UPI leg** per §3.7 (simulated path is fully
   buildable in one session, no license, no external account).
4. Follow repo conventions: build on `main`, `git fetch` + rebase before push, **never
   force-push**, verify (typecheck + tests) before pushing, log any `shared/*` change in
   `INTEGRATION_LOG.txt`.
5. Other open roadmap items unaffected by this session: dispute AI triage (#1), Railway+Neon
   deploy (#6), public testnet (#7).

---

*This capture is intentionally exhaustive per the request — every concept from the parallel
session is either mapped to existing Corridor code (§2, §4) or specified as forward work
(§3). If a future reader finds a session idea not listed here, it belongs in §4.*
