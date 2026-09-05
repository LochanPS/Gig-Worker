# Deploy to a public testnet (roadmap #7)

Put the four contracts on a real, public test chain so the jury can see settlement
transactions on a block explorer. Everything is **wired** — the deploy is
chain-agnostic and the frontend surfaces explorer links. What is left is the part only
you can do: supply an **RPC URL** and a **funded testnet private key**, and run one
command. No real money is involved (testnet coins are valueless).

> **Security.** The deployer / platform key signs real testnet transactions, so it goes
> only in a local `.env` (gitignored) that you fill in yourself — never paste it into
> chat and never commit it. This is safe only because the chain is a valueless testnet;
> never use a mainnet / real-value key here. A production deployment uses a custody / MPC
> signer (roadmap #14), not a raw key in `.env`.

## 1. Pick a chain and get faucet ETH

| Chain | chainId | Explorer | Faucet |
|---|---|---|---|
| **Base Sepolia** (recommended — fast, cheap) | 84532 | https://sepolia.basescan.org | Coinbase / Alchemy Base Sepolia faucet |
| Polygon Amoy | 80002 | https://amoy.polygonscan.com | Polygon Amoy faucet (POL) |
| Ethereum Sepolia | 11155111 | https://sepolia.etherscan.io | Sepolia faucet |

Fund the address of the key you will deploy with (a small amount of test ETH/POL is
plenty — deploying four small contracts).

## 2. Deploy the contracts

From `contracts/`, set the three env vars and run the deploy. It reads
`RPC_URL`, `CHAIN_ID`, `DEPLOYER_PRIVATE_KEY` (and optional `TREASURY_ADDRESS`,
defaulting to the deployer), deploys all four, and **writes**
`shared/abis/addresses.<chainId>.json`:

```bash
cd contracts
RPC_URL="https://sepolia.base.org" CHAIN_ID=84532 DEPLOYER_PRIVATE_KEY="0xYOUR_FUNDED_TESTNET_KEY" npm run deploy
```

The output prints the four addresses and their explorer links, e.g.
`EscrowVault: https://sepolia.basescan.org/address/0x…`. Open one to confirm it deployed.

> `addresses.<chainId>.json` for a real chain is **committed** (only
> `addresses.local.json` is gitignored), so a hosted backend reuses the same contracts
> across restarts instead of redeploying.

## 3. Commit the addresses

```bash
git add shared/abis/addresses.84532.json && git commit -m "chore: Base Sepolia contract addresses" && git push
```

## 4. Point the apps at the chain

- **Frontend** — build with `VITE_CHAIN_ID=84532` (alongside `VITE_API_BASE`). Tx hashes
  in the payment timeline and the "Network" line then link to the block explorer. With no
  `VITE_CHAIN_ID` the app assumes local anvil (31337) and shows hashes as plain text.
- **Backend (only if running real on-chain settlement)** — set `SETTLEMENT_MODE=real`,
  `RPC_URL`, `CHAIN_ID=84532`, and `PLATFORM_PRIVATE_KEY` (the platform/owner key — the
  same funded key is fine for the demo; it mints MockUSDC, attests credentials, and calls
  release/refund). On an ephemeral host you can pass the whole address record inline via
  `DEPLOYED_ADDRESSES` (JSON) instead of relying on the committed file. Left unset, the
  backend keeps using simulated settlement — the app still works end to end.

## 5. Verify

- Open the explorer links from step 2 — the contracts show as deployed.
- Run a payment in the app; the FUNDED / RELEASED timeline steps now carry a tx hash that
  links to the explorer, and the payment detail shows the network name.

## What's real vs still simulated

- **Real on testnet:** the four contracts, and (with `SETTLEMENT_MODE=real`) the fund /
  release / refund / anchor transactions — visible on the explorer.
- **Still simulated / off-chain:** `MockUSDC` stands in for real USDC (roadmap #15); the
  INR off-ramp uses the simulated `PayoutRail` (real PA-CB rail = roadmap #13); FX is a
  reference rate (#12). Testnet value is valueless — this is a demo of the mechanism, not
  real money movement.
