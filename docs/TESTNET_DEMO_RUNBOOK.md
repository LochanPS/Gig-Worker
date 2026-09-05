# Testnet demo runbook — real Base Sepolia transactions, MetaMask as the proof surface

Everything here produces **genuine wallet-to-wallet transactions on Base Sepolia**, shown
through the app you already have. Nothing about the UI changes: it never signs anything.
You flip the backend into real mode, and the same "Confirm & settle" button starts
producing real transactions.

## Where the keys go

**Never paste a private key into a chat, an issue, or a commit.** They go in
`backend/.env`, which is gitignored. Every script below reads them from the environment.

Testnet coins are valueless, but a key that leaks is a key you can never reuse — and the
habit is what matters. Use fresh wallets that have only ever held test funds.

## What signs what

| Transaction | Signed by | Needs gas |
|---|---|---|
| `USDC.approve` + `EscrowVault.fund` | the **paying company's** key | **yes** |
| `EscrowVault.release` / `refund` | the platform key | yes |
| `IdentityRegistry.setCredential`, `MockUSDC.mint` | the platform key | yes |
| receiving USDC | — | **no** |

Two consequences that catch people out:

1. **`PLATFORM_PRIVATE_KEY` must be the same key as `DEPLOYER_PRIVATE_KEY`.** `mint` and
   `setCredential` are `onlyOwner` on contracts owned by the deployer, and `EscrowVault`
   grants `PLATFORM_ROLE` only to its deploy-time admin (the deployer). Different keys →
   the chain handshake fails → the backend falls back to simulated.
2. **The paying company's wallet needs testnet ETH.** The per-wallet gas top-up in
   `real-settlement.ts` is deliberately local-only, so nothing funds it for you. Payees
   never sign and need no gas at all.

## Runbook

Order matters: `walletKey` is written at **seed** time, so the keys must be in the
environment *before* you reseed.

### 1. `backend/.env`

```
DATABASE_URL=postgresql://…
JWT_SECRET=<32+ random bytes>
RPC_URL=https://sepolia.base.org
CHAIN_ID=84532
SETTLEMENT_MODE=real
SETTLEMENT_STRICT=true
PLATFORM_PRIVATE_KEY=0x…          # same key as DEPLOYER_PRIVATE_KEY
DEPLOYER_PRIVATE_KEY=0x…
TREASURY_ADDRESS=0x…
DEMO_WALLET_KEYS={"novatek@demo.gg":"0x…","priya@demo.gg":"0x…"}
```

`DEMO_WALLET_KEYS` maps a seeded user's email to the wallet it should transact from.
Malformed JSON is silently ignored by the seed and every actor falls back to a random,
unfunded key — `preflight:chain` catches that.

### 2. Deploy the contracts, once

No Foundry needed: the bytecode is committed in `shared/abis/*.json`.

```bash
RPC_URL=https://sepolia.base.org CHAIN_ID=84532 DEPLOYER_PRIVATE_KEY=0x… \
  pnpm --filter ./contracts deploy
```

Writes `shared/abis/addresses.84532.json`. **Commit it** so a redeploy isn't needed on
every restart.

### 3. Fund the paying wallet

Send Base Sepolia ETH to Novatek's address (`preflight:chain` prints it) from a Base
Sepolia faucet. ~0.01 ETH is plenty. The platform key needs gas too.

### 4. Preflight — before anything else

```bash
pnpm --filter ./contracts preflight:chain
```

Checks RPC and chain id, that all four contracts have bytecode, that the platform key
owns `MockUSDC` and `IdentityRegistry` and holds `PLATFORM_ROLE`, and each demo wallet's
gas, USDC and on-chain attestation. Every line must pass.

### 5. Two real transactions, before the app is involved

```bash
pnpm --filter ./contracts smoke:testnet
```

Funds and releases an escrow with your real keys and asserts the payee received
amount−fee and the treasury the fee. Open the printed BaseScan links.

**If this fails, stop.** The app cannot fix a chain problem, and starting the backend
would only make the failure harder to see.

### 6. Migrate and seed

```bash
pnpm --filter ./backend prisma:migrate    # demo:reset does NOT migrate
pnpm demo:reset
```

### 7. Start the backend

With `SETTLEMENT_STRICT=true` it either boots in real mode or refuses to boot and tells
you why. Confirm:

```bash
curl -s localhost:4000/api/v1/meta      # {"settlementMode":"real","chainId":84532,…}
pnpm --filter ./backend e2e:local       # full payment loop through the real API
```

### 8. Build the frontend

`VITE_API_BASE` and **`VITE_CHAIN_ID=84532`**. Both are inlined at build time, so this
needs a rebuild, not a restart. The sidebar badge must read **"Base Sepolia · live
on-chain"**. If it reads "Simulated settlement", the tx hashes are placeholders — fix
that before presenting.

### 9. Pay

Novatek → Priya, EUR 500, purpose P0802. Four real transactions follow: `approve` and
`fund` signed by Novatek, then `release` and the compliance `anchor` by the platform.

## MetaMask as the proof surface

1. Add the **Base Sepolia** network.
2. Import Novatek's and Priya's private keys as accounts.
3. Import the **MockUSDC** address from `addresses.84532.json` as a custom token —
   **6 decimals**, not 18.

Put MetaMask beside the app. On "Confirm & settle", Priya's USDC balance rises and the
transfer appears under Activity.

There is **no signing popup** — the backend holds the keys and signs server-side. Say that
out loud rather than letting anyone assume otherwise: "these are the real wallets, the
platform signs for them, and importing a key like this is a testnet-only practice."

The design point worth making: `release` is platform-signed by contract design, so a payee
can never release escrow to themselves. Only the payer's `fund` is payer-signed.

## When something is wrong

| Symptom | Cause |
|---|---|
| Badge says "Simulated" but you set `SETTLEMENT_MODE=real` | The chain handshake failed. With `SETTLEMENT_STRICT=true` the backend would have refused to boot — read its startup error. |
| `preflight:chain`: owner is not the platform key | `PLATFORM_PRIVATE_KEY` ≠ `DEPLOYER_PRIVATE_KEY`. Use one key for both, or redeploy. |
| `preflight:chain`: contract has no bytecode | Wrong `CHAIN_ID`, or `addresses.<chainId>.json` is from another chain. Redeploy. |
| Payment fails at funding | The paying wallet has no gas. Nothing tops it up on a public chain. |
| `EscrowVault: payer/payee not verified` | The wallet is not attested in `IdentityRegistry`. The backend attests at boot in real mode; check it actually reached real mode. |
| Explorer link 404s | You are in simulated mode with `VITE_CHAIN_ID` set. The badge and `TxLink` should now prevent this — if you see it, the frontend build is stale. |
| QR card missing after a payment | The payee's newest INR account is not the UPI one. `pnpm demo:reset` restores it. |

## Fallback

If the venue network is unusable, unset `SETTLEMENT_MODE` (or `SETTLEMENT_STRICT`) and
restart. The full lifecycle, compliance engine, agent, UPI off-ramp and documents all work
with no chain. The badge will read "Simulated settlement" and tx hashes render as inert
text — which is exactly what you want: nothing on screen claims to be on-chain when it
isn't.
