# Contract ABIs — owned by P1 (track/chain)

P1 commits compiled ABIs here by **Day 1 noon** so P2's settlement service can
type on-chain calls with `viem`.

Expected files (from TRD 3):

- `MockUSDC.json`
- `IdentityRegistry.json`
- `EscrowVault.json`
- `AuditAnchor.json`

Then add an `index.ts` that re-exports each ABI `as const` (viem needs the
`as const` for typed calls), e.g.:

```ts
import EscrowVault from "./EscrowVault.json" with { type: "json" };
export const escrowVaultAbi = EscrowVault.abi as const;
```

Also publish deployed addresses (anvil + Amoy) — either here as
`addresses.json` or via backend env. Note the change in `INTEGRATION_LOG.txt`.
