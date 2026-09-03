# GigBridge — Go-Live Plan (Real On-Chain + Hosted + Scale)

*Status doc created 2026-09-03. This is the single "what's next and how" document.
It supersedes the Day-3 lines in the older roadmaps where they conflict. Companion
to PRD.txt / TRD.txt / ROADMAP_3_PERSON_3_DAY.txt / ROADMAP_SIMPLE.txt.*

---

## 0. TL;DR — two layers, be honest about which is which

| Layer | What it is | Effort | In scope now? |
|---|---|---|---|
| **L1 — Real on-chain tx** | Deploy our 4 contracts to **Base Sepolia**, run a real payment, get real tx hashes on a public explorer | **Hours** (code already chain-agnostic) | **Yes — today** |
| **L1.5 — Hosted product** | Anyone can open a URL, log in, run a payment. Free tier hosting | **~1 day** | **Yes — this week** |
| **L2 — Real money platform** | Moving real EUR/INR between real companies/freelancers | **Months** — licensing, fiat on/off-ramps, KYC/AML, custody, banking, capital, counsel | **No** — partner-first, later |

The blockchain part is the *easy* part. The company is the fiat rails + compliance
+ workflow. We build L1/L1.5 now (free), and line up L2 partners over 30–90 days.

**Legal note:** this doc is engineering/strategy orientation, **not legal or
financial advice**. Get fintech counsel before touching real customer money. No real
funds are moved by this plan — L1 uses a test token on a test network.

---

## 1. Where the code already is (why L1 is small)

The chain layer was built chain-agnostic. `contracts/chain.ts` and
`contracts/deploy.ts` already read everything from env:

```
RPC_URL, CHAIN_ID, PLATFORM_PRIVATE_KEY, DEPLOYER_PRIVATE_KEY, TREASURY_ADDRESS
```

Settlement is gated by `SETTLEMENT_MODE=real` and already proven end-to-end on a
local anvil chain (real `fund`/`release`/`refund` tx hashes, event listener, payee
receives amount−fee). Switching networks = **changing env values**, not rewriting code.

**What this repo change added (this branch) to make hosting + testnet real:**
- `deploy.ts` now persists deployed addresses **per chain** (`addresses.<chainId>.json`,
  committed) and accepts an inline `DEPLOYED_ADDRESSES` env override — so a hosted
  backend on Base Sepolia **reuses** the same contracts across restarts instead of
  redeploying on every boot.
- Frontend `api.ts` / `ws.ts` honor `VITE_API_BASE` so the SPA can live on a
  different origin (Vercel) from the backend (Railway/Render).
- `render.yaml` blueprint + `frontend/vercel.json` + expanded `.env.example`.

---

## 2. The two remaining honest gaps for a real chain

1. **Test token vs real USDC.** Our `EscrowVault.fund()` requires a verified party
   and pulls an ERC-20. On testnet we deploy **our own MockUSDC** (owner faucet
   works → real on-chain transfers, free). Real Base Sepolia USDC exists but can
   only be dripped from Circle's faucet to specific wallets and **cannot be minted
   by us**, so MockUSDC-on-testnet is the correct L1 demo path. Swapping to real
   USDC is a Base **mainnet** step (Layer 2), costs cents of gas, and means using
   the canonical USDC address instead of deploying our own token.
2. **Gas.** The platform/deployer wallet spends **real testnet ETH** (free from a
   faucet) for deploy + each settlement + the boot-time faucet/gas top-ups in
   `ensureChainReady`. Fund it once from a faucet; monitor the balance.

Nothing else blocks a genuinely on-chain, explorer-visible transaction.

---

## 3. DO THIS TODAY — real on-chain on Base Sepolia (free)

> You run these locally with **your** testnet key. I never handle real keys.
> A "testnet key" holds only free test ETH and controls nothing of value — but
> still treat it as a secret and never reuse a key that holds real funds.

**Step A — get the inputs (see the shopping list, §6):** a Base Sepolia RPC URL, a
fresh testnet wallet private key, and some Base Sepolia ETH from a faucet.

**Step B — deploy our contracts to Base Sepolia (one command):**

```bash
cd "contracts"
RPC_URL="<your Base Sepolia RPC>" \
CHAIN_ID=84532 \
DEPLOYER_PRIVATE_KEY="<your funded testnet key>" \
TREASURY_ADDRESS="<your wallet address>" \
pnpm --filter @gigbridge/contracts deploy:local
```

This writes `shared/abis/addresses.84532.json`. **Commit that file** (it's the
public contract addresses, not a secret) so the hosted backend can find them.

**Step C — run a real payment against the real chain:**

```bash
# backend/.env
DATABASE_URL="<Neon Postgres URL>"
JWT_SECRET="<random>"
RPC_URL="<your Base Sepolia RPC>"
CHAIN_ID=84532
PLATFORM_PRIVATE_KEY="<your funded testnet key>"
DEPLOYER_PRIVATE_KEY="<same>"
TREASURY_ADDRESS="<your wallet address>"
SETTLEMENT_MODE=real
```

Then migrate + seed + boot, log in, create a payout, confirm. The receipt shows
real `fund`/`release` tx hashes. **Verify them on** `https://sepolia.basescan.org`.
That is a real on-chain transaction.

---

## 4. DO THIS WEEK — host it so anyone can log in (free)

Split hosting, all free tier:

| Piece | Host (free) | Notes |
|---|---|---|
| **Postgres** | **Neon** | serverless PG, free branch; gives `DATABASE_URL` |
| **Backend** (Fastify + viem + WS) | **Railway** (trial credit) or **Render** (free web service) | runs via `tsx`, no build step; needs the env from §3 + `DEPLOYED_ADDRESSES` or the committed `addresses.84532.json`; expose `PORT` |
| **Frontend** (Vite SPA) | **Vercel** or **Cloudflare Pages** | build `frontend`; set `VITE_API_BASE=https://<backend-url>` |

**Backend on Render:** the committed `render.yaml` blueprint deploys it; fill secrets
in the dashboard. **Backend on Railway:** new project → deploy from repo → root
`backend` → start `pnpm --filter ./backend exec tsx src/index.ts` → add env vars.

**Frontend on Vercel:** import repo → root `frontend` → framework Vite →
`vercel.json` handles SPA routing → env `VITE_API_BASE` = backend URL.

**CORS/WS:** backend already sends permissive CORS and the WS client derives its host
from `VITE_API_BASE`. Nothing else to wire.

Cost: **$0** on free tiers for a demo. Watch Render's free-tier cold starts and
Railway's trial credit; Neon and Vercel free tiers are generous.

---

## 5. What we still need to BUILD to scale to "anyone can use it"

Ordered by what actually blocks real users. Most are new phases (§8 roadmap).

**Must-have before strangers log in:**
1. **Self-serve signup** — today users are seeded. Need company/freelancer
   registration + email verification. (No public signup = no "anyone".)
2. **Wallet handling that isn't plaintext demo keys** — the seed stores raw
   `walletKey`s. For real users: non-custodial (WalletConnect/MetaMask) or MPC
   custody (Privy / Turnkey). This is the single biggest security gap.
3. **Secrets & config hardening** — no keys in `.env.example`-style defaults in
   prod; rotate `JWT_SECRET`; platform key in the host's secret store only.
4. **Rate limiting + input hardening** on the public API.
5. **Real KYC/AML** behind the existing Identity seam (Sumsub / Persona / Onfido
   sandbox) instead of seeded credentials.

**Needed to be trustworthy:**
6. **Smart-contract audit** before any mainnet/real-value use — `EscrowVault` holds
   funds; non-negotiable.
7. **Observability** — Sentry, structured logs already exist, add error tracking +
   a `/health` status page + basic metrics.
8. **Gas abstraction** (paymaster / ERC-4337) so users never need ETH.

**Needed to be a business (Layer 2, partner-first):**
9. **Fiat on/off-ramp partners** — Circle Mint (USDC↔USD), a regulated EMI for EUR,
   an RBI PA-CB partner for INR. This is where crypto-payment startups live or die.
10. **Licensing/compliance posture** — stay non-custodial to minimize it; counsel
    engaged before enforce-mode with real money.

---

## 6. SHOPPING LIST — everything you go get (mostly free)

Tick these off; most take minutes and cost nothing.

### For real on-chain today (L1) — all free
- [ ] **Base Sepolia RPC URL** — free from **Alchemy** or **Infura** (make an app,
      pick "Base Sepolia"), or use the public `https://sepolia.base.org`.
- [ ] **A fresh testnet wallet** — create one in MetaMask *just for this*; export its
      **private key**. Never a wallet that holds real funds.
- [ ] **Base Sepolia ETH** — free from a faucet: Coinbase Developer Platform faucet,
      Alchemy Base Sepolia faucet, or QuickNode faucet. Fund the wallet above.
- [ ] **Your wallet address** — for `TREASURY_ADDRESS` (fee collector).

### For hosting (L1.5) — free tiers
- [ ] **Neon account** → create a project → copy `DATABASE_URL`.
- [ ] **Railway** *or* **Render** account (backend).
- [ ] **Vercel** *or* **Cloudflare Pages** account (frontend).
- [ ] **A random `JWT_SECRET`** — generate one (`openssl rand -hex 32`).

### Optional now, needed for L2 later
- [ ] **Anthropic API key** — already supported (`ANTHROPIC_API_KEY`); empty =
      deterministic template explanations. Only needed for LLM-written reasoning.
- [ ] **Sumsub / Persona / Onfido** sandbox — real KYC (30-day phase).
- [ ] **Privy / Turnkey** — MPC wallets (30-day phase).
- [ ] **Circle** developer account — USDC + Circle Mint (60-day phase).
- [ ] **Fintech lawyer** — before any real-money enforce-mode.

**Give me these three and I can wire the hosted testnet build end-to-end:** the RPC
URL, the Neon `DATABASE_URL`, and the backend host you pick. I will *not* take the
private key — you paste that into the host's secret store yourself.

---

## 7. Targets (straightened out)

| Horizon | Target | Signal it's real |
|---|---|---|
| **Today** | Real Base Sepolia tx with explorer link | A payment's `fund`/`release` hashes resolve on sepolia.basescan.org |
| **This week** | Hosted, public URL, self-serve login | Someone who is not you logs in and runs a payout in shadow |
| **30 days** | No plaintext keys; MPC wallets; KYC sandbox; contract audit booked | Zero secrets in code; a real KYC check runs |
| **60 days** | Off-ramp partner conversations; 3–5 design-partner startups on ONE corridor (India↔EU or India↔US) in sandbox | A design partner runs real workflow (fiat still simulated) |
| **90 days** | 0.75% fee live in the pilot corridor; unit economics measured; counsel engaged | First real fee collected via a partner rail |
| **Company milestone** | ~$100k monthly volume at ≥0.5% net take, <2% manual-review rate | Fundable metrics |

---

## 8. Updated roadmap — new phases (append to the 3-day roadmap)

The 3-person/3-day hackathon roadmap (P1 chain / P2 backend / P3 frontend) is
**complete**. These are the post-hackathon phases:

- **P4 — Real chain + hosting (this branch → this week)**
  1. Chain-agnostic deploy (per-chain addresses, env override) — **done (this branch)**
  2. Frontend `VITE_API_BASE` for split hosting — **done (this branch)**
  3. Deploy contracts to Base Sepolia, commit `addresses.84532.json`
  4. Neon Postgres + backend on Railway/Render + frontend on Vercel
  5. Public URL runs a real testnet payment end-to-end

- **P5 — Real users (30 days)**
  1. Self-serve signup + email verification
  2. Non-custodial / MPC wallets (Privy or Turnkey) — kill plaintext keys
  3. Secrets hardening + API rate limiting
  4. KYC/AML sandbox behind the Identity seam
  5. Smart-contract audit
  6. Sentry + status page

- **P6 — Real money, partner-first (60–90 days)**
  1. Circle Mint (USDC↔USD) integration
  2. EU EMI partner (EUR) + India PA-CB partner (INR) conversations
  3. Gas abstraction (paymaster)
  4. One pilot corridor live with 0.75% fee via partner rails
  5. Fintech counsel; limitation-of-liability terms; enforce-mode opt-in

---

## 9. Competitive lessons baked into the plan

- The chain is commoditized — nobody wins on "we use blockchain." Win on
  **off-ramps, compliance, and workflow** (we already built the workflow: invoices,
  compliance engine, audit anchor, receipts).
- **Own the workflow, not just the transfer** (Deel's lesson) — payment is sticky
  only as the last step of invoices + approvals + compliance docs.
- **Partner for rails, don't rebuild them** (Bridge/Circle/Nium).
- **Off-ramp to local fiat is where these startups die** — solve INR/EUR cash-out
  or it's a toy.
- **Regulation is the moat, not the enemy** — Diem died fighting it; Circle/Stripe
  won by embracing it. Stay non-custodial, partner-first.

Our defensible differentiators: the **autonomous compliance agent**, **transparent
pricing**, **verify-once identity**, and the **on-chain audit trail**. Wedge = one
painful corridor for startups paying 5–50 freelancers/month; win it, then each new
corridor's rule pack compounds.
