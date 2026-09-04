# Real on-chain settlement (anvil-first)

The backend ships two settlement drivers behind one interface
(`backend/src/settlement/interface.ts`):

- **simulated** (default) — deterministic fake tx hashes; the whole payment
  lifecycle completes with no chain. Great for UI/demo work.
- **real** (`SETTLEMENT_MODE=real`) — every fund / release / refund / credential /
  audit-anchor is a real transaction on an EVM chain, via the viem ops in
  `contracts/chain.ts`.

The factory in `backend/src/settlement/index.ts` picks **real** only when
`SETTLEMENT_MODE=real` **and** a `PLATFORM_PRIVATE_KEY` is set; otherwise it
stays simulated. So real settlement is a config flip, nothing else changes.

## What real mode does automatically

- **Deploy-on-boot** — `index.ts` calls `ensureDeployed()`; if the four
  contracts are already live at the recorded addresses it is a no-op, else it
  deploys `MockUSDC`, `IdentityRegistry`, `AuditAnchor`, `EscrowVault` and writes
  `shared/abis/addresses.local.json` (gitignored).
- **On verification** — `issueCredential()` mirrors the credential hash to
  `IdentityRegistry` (so `EscrowVault`'s verified-party gate passes) and, for a
  company, faucets the payer wallet with gas (0.1 ETH) + 100,000 MockUSDC.
- **On confirm** — the orchestrator funds escrow (payer signs `approve` + `fund`),
  then releases (platform signs), emitting real tx hashes onto the timeline.
  `fundEscrow` also tops up the payer's gas/USDC if a payment exceeds the faucet.
- **Event listener** — `watchEscrow()` logs every `PaymentFunded/Released/…`
  event as the on-chain source of truth (PRD FR-5.3).

## Run it locally (validated path: anvil + pnpm)

Prereqs: Foundry (`anvil`), Postgres running, deps installed
(`pnpm install`, then `pnpm --filter @gigbridge/backend db:generate`).

```bash
# 1. Local chain
anvil                                   # chain-id 31337, account 0 = demo key

# 2. Point the backend at Postgres + anvil in real mode (backend/.env)
cp .env.example backend/.env            # already has the anvil demo keys
echo "SETTLEMENT_MODE=real" >> backend/.env
echo "FX_OFFLINE=true"      >> backend/.env   # offline-safe FX

# 3. Schema + seed (seed deploys contracts, issues on-chain credentials, faucets)
pnpm --filter @gigbridge/backend db:migrate:dev
SETTLEMENT_MODE=real pnpm --filter @gigbridge/backend seed

# 4. Boot the backend (deploy-on-boot no-ops; event listener starts)
SETTLEMENT_MODE=real pnpm --filter @gigbridge/backend dev

# 5. In another shell: full-stack real-chain e2e
#    logs in as Novatek -> pays Priya EUR 500 -> asserts on-chain escrow +
#    payee MockUSDC balance rose by (amount - fee).
pnpm --filter @gigbridge/contracts e2e:real
```

A green run prints `✅ FULL-STACK REAL-CHAIN E2E PASSED`.

## Run it with Docker (one command; not yet verified in CI)

```bash
docker compose -f infra/docker-compose.yml up --build
```

Brings up Postgres + anvil + the backend in real mode (migrated, seeded,
contracts deployed, listener running) on `:4000`. The frontend is run separately
for now (`pnpm --filter @gigbridge/frontend dev`) and joins compose after the UI
rebuild.

## Going to a public testnet (later)

The deploy + ops are chain-agnostic. To target e.g. Base Sepolia, set in
`backend/.env`:

```
RPC_URL=https://sepolia.base.org        # or an Alchemy/Infura URL
CHAIN_ID=84532
PLATFORM_PRIVATE_KEY=0x<funded testnet key>
DEPLOYER_PRIVATE_KEY=0x<funded testnet key>
SETTLEMENT_MODE=real
EXPLORER_BASE_URL=https://sepolia.basescan.org
```

Addresses for non-local chains are written to `shared/abis/addresses.<chainId>.json`
(commit it so a hosted backend reuses the same contracts across restarts), or
pass the record inline via `DEPLOYED_ADDRESSES`. Note: the faucet/mint path uses
`MockUSDC` (owner-only mint) — on a real testnet keep using MockUSDC for the
demo, or swap in a real USDC address and fund wallets out of band.
```
