import type { Address, Hex } from "viem";
import { createChainOps, type ChainOps } from "@gigbridge/contracts/chain";
import type { SettlementService, FundParams, SettlementResult } from "./interface.js";
import { config } from "../lib/config.js";

// Real on-chain settlement (TRD 4.7 / 8). Delegates every action to the viem
// chain ops that live with the contracts (contracts/chain.ts), so all ABI +
// wallet wiring stays in one place. Selected by the factory when
// SETTLEMENT_MODE=real; otherwise SimulatedSettlement drives the pipeline.

/** Gas top-up (0.1 ETH) so a freshly generated custodial demo wallet can sign. */
const GAS_TOPUP_WEI = 10n ** 17n;

function keyToHex(key: string): Hex {
  return (key.startsWith("0x") ? key : `0x${key}`) as Hex;
}

export class OnchainSettlement implements SettlementService {
  readonly mode = "onchain" as const;
  private _ops: ChainOps | null = null;

  /** Lazily construct chain ops — deferred so simulated mode never touches RPC. */
  private ops(): ChainOps {
    if (!this._ops) {
      this._ops = createChainOps({
        rpcUrl: config.chain.rpcUrl,
        chainId: config.chain.chainId,
        platformKey: config.chain.platformPrivateKey || undefined,
      });
    }
    return this._ops;
  }

  async fundEscrow(p: FundParams): Promise<SettlementResult> {
    const ops = this.ops();
    const amount = ops.minorToUsdc(p.amountMinor);
    const fee = ops.minorToUsdc(p.feeMinor);
    // Idempotent safety net: guarantee the payer has gas + enough USDC for this
    // specific payment (covers amounts beyond the initial verification faucet).
    await this.ensurePayerReady(p.payerKey, amount);
    const txHash = await ops.fund(
      p.payerKey,
      p.escrowId as Hex,
      p.payeeAddress as Address,
      amount,
      fee,
      p.complianceHash as Hex,
    );
    return { txHash };
  }

  async releaseEscrow(escrowId: string): Promise<SettlementResult> {
    return { txHash: await this.ops().release(escrowId as Hex) };
  }

  async refundEscrow(escrowId: string): Promise<SettlementResult> {
    return { txHash: await this.ops().refund(escrowId as Hex) };
  }

  async anchorDecision(decisionHash: string): Promise<SettlementResult> {
    return { txHash: await this.ops().anchor(decisionHash as Hex) };
  }

  async setCredential(address: string, hash: string, expiryUnix: number): Promise<SettlementResult> {
    return {
      txHash: await this.ops().setCredential(address as Address, hash as Hex, BigInt(expiryUnix)),
    };
  }

  /**
   * Provision a payer (company) wallet at verification: send gas so the
   * custodial demo key can sign, then faucet-mint MockUSDC (BUILD_CONTRACTS §2).
   * Both steps are idempotent — skipped when the wallet already has enough.
   */
  async provisionPayer(address: string, usdcMinor: number): Promise<void> {
    const ops = this.ops();
    const addr = address as Address;
    const eth = await ops.ethBalance(addr);
    if (eth < GAS_TOPUP_WEI) await ops.sendGas(addr, GAS_TOPUP_WEI);
    const want = ops.minorToUsdc(usdcMinor);
    const have = await ops.usdcBalance(addr);
    if (have < want) await ops.mintUsdc(addr, want - have);
  }

  /** Ensure the payer key's address is gas-funded and holds >= `amount` USDC. */
  private async ensurePayerReady(payerKey: string, amount: bigint): Promise<void> {
    const ops = this.ops();
    const { privateKeyToAccount } = await import("viem/accounts");
    const payer = privateKeyToAccount(keyToHex(payerKey)).address;
    const eth = await ops.ethBalance(payer);
    if (eth < GAS_TOPUP_WEI) await ops.sendGas(payer, GAS_TOPUP_WEI);
    const have = await ops.usdcBalance(payer);
    if (have < amount) await ops.mintUsdc(payer, amount - have);
  }
}
