import type { PaymentState } from "@gigbridge/shared";
import { prisma } from "../lib/db.js";
import { audit } from "../lib/audit.js";
import { hub } from "../ws/hub.js";
import { ApiError } from "../lib/errors.js";
import { escrowIdFromUuid } from "../lib/crypto.js";
import { assertTransition } from "./stateMachine.js";
import { paymentInclude, toPaymentDTO, type PaymentWithRelations } from "./mappers.js";
import { getSettlement } from "../settlement/index.js";
import { runCompliance, type CandidatePayment } from "../compliance/engine.js";
import { raiseAlerts } from "../compliance/anomaly.js";
import { explain } from "../agent/service.js";
import { consumeLockedQuote } from "../fx/service.js";
import { convertMinor, formatMinor, computeFeeMinor } from "../lib/money.js";
import { isVerified } from "../identity/credentials.js";
import { notify } from "../notifications/service.js";
import fallback from "../fx/fallback.json" with { type: "json" };

// The Payment Orchestrator is the ONLY writer of Payment.state. Every
// transition is validated, persisted with a timeline entry, audit-logged, and
// broadcast over the websocket (TRD 4.2).

async function load(id: string): Promise<PaymentWithRelations> {
  const p = await prisma.payment.findUnique({ where: { id }, include: paymentInclude });
  if (!p) throw ApiError.notFound("Payment not found");
  return p;
}

async function transition(
  paymentId: string,
  to: PaymentState,
  opts: { note?: string; txHash?: string; actorId?: string | null; extra?: Record<string, unknown> } = {},
): Promise<PaymentWithRelations> {
  const current = await load(paymentId);
  assertTransition(current.state, to);

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      state: to,
      ...(opts.extra ?? {}),
      ...(to === "COMPLETED" ? { completedAt: new Date() } : {}),
      timeline: { create: { state: to, note: opts.note, txHash: opts.txHash } },
    },
    include: paymentInclude,
  });

  await audit({
    actorId: opts.actorId ?? null,
    action: `PAYMENT_${to}`,
    entity: "Payment",
    entityId: paymentId,
    before: { state: current.state },
    after: { state: to, txHash: opts.txHash },
  });

  const dto = toPaymentDTO(updated);
  hub.toUsers([updated.companyId, updated.freelancerId], {
    type: "payment.state",
    paymentId,
    state: to,
    timeline: dto.timeline,
  });
  hub.toAdmins({ type: "payment.state", paymentId, state: to, timeline: dto.timeline });
  return updated;
}

/**
 * Create a payment (DRAFT) then run compliance (COMPLIANCE_CHECK -> APPROVE
 * path leaves it awaiting confirm; FLAG -> FLAGGED for admin; REJECT -> REJECTED).
 */
export async function createAndScreen(params: {
  companyId: string;
  input: CandidatePayment & { invoiceRef?: string };
}): Promise<PaymentWithRelations> {
  const { companyId, input } = params;

  const created = await prisma.payment.create({
    data: {
      companyId,
      freelancerId: input.freelancerId,
      srcCurrency: input.srcCurrency,
      dstCurrency: input.dstCurrency,
      srcAmountMinor: input.srcAmountMinor,
      purposeCode: input.purposeCode,
      invoiceRef: input.invoiceRef,
      state: "DRAFT",
      escrowId: null,
      timeline: { create: { state: "DRAFT", note: "Payment drafted" } },
    },
    include: paymentInclude,
  });

  await transition(created.id, "COMPLIANCE_CHECK", { note: "Running compliance checks" });

  const outcome = await runCompliance(input);
  const explanation = await explain({
    payerName: created.company.name,
    payeeName: created.freelancer.name,
    payerCountry: input.payerCountry,
    payeeCountry: input.payeeCountry,
    srcCurrency: input.srcCurrency,
    dstCurrency: input.dstCurrency,
    amountLabel: `${input.srcCurrency} ${formatMinor(input.srcAmountMinor)}`,
    purposeCode: input.purposeCode,
    verdict: outcome.verdict,
    results: outcome.results,
  });

  // Anchor the decision hash (AuditAnchor.sol; simulated when no chain).
  const settlement = getSettlement();
  const anchor = await settlement.anchorDecision(outcome.decisionHash);

  const decision = await prisma.complianceDecision.create({
    data: {
      paymentId: created.id,
      verdict: outcome.verdict,
      ruleResultsJson: outcome.results as unknown as object,
      agentExplanation: explanation,
      anchorTxHash: anchor.txHash,
    },
  });
  await prisma.payment.update({
    where: { id: created.id },
    data: { complianceDecisionId: decision.id },
  });

  // Anomaly/sanctions alerts for the admin.
  await raiseAlerts(created.id, outcome.results);

  if (outcome.verdict === "REJECT") {
    await transition(created.id, "REJECTED", { note: "Compliance rejected" });
    await notify({
      userId: companyId,
      kind: "PAYMENT",
      title: "Payment rejected",
      body: `Payment to ${created.freelancer.name} was blocked by compliance.`,
    });
  } else if (outcome.verdict === "FLAG") {
    await transition(created.id, "FLAGGED", { note: "Flagged for manual review" });
    await notify({
      userId: companyId,
      kind: "PAYMENT",
      title: "Payment under review",
      body: `Payment to ${created.freelancer.name} is held for compliance review.`,
    });
  }
  // APPROVE stays in COMPLIANCE_CHECK until the payer confirms (locks + funds).

  return load(created.id);
}

/** Admin resolves a flagged payment. */
export async function resolveFlag(
  paymentId: string,
  action: "APPROVE" | "REJECT",
  note: string,
  adminId: string,
): Promise<PaymentWithRelations> {
  const p = await load(paymentId);
  if (p.state !== "FLAGGED") throw ApiError.conflict("Payment is not awaiting review");

  if (p.complianceDecisionId) {
    await prisma.complianceDecision.update({
      where: { id: p.complianceDecisionId },
      data: { reviewedBy: adminId, reviewNote: note },
    });
  }
  if (action === "REJECT") {
    await transition(paymentId, "REJECTED", { note: `Admin rejected: ${note}`, actorId: adminId });
    await notify({
      userId: p.companyId,
      kind: "PAYMENT",
      title: "Payment rejected",
      body: `Compliance rejected your payment to ${p.freelancer.name}.`,
    });
  } else {
    // Approved out of the queue -> ready to confirm (no state jump to RATE_LOCKED
    // yet; the payer still confirms to lock + fund). We move FLAGGED->RATE_LOCKED
    // is not valid without a quote, so approval marks the decision and the payer
    // confirms next. Represent "approved" by resetting to COMPLIANCE_CHECK-cleared:
    await transition(paymentId, "RATE_LOCKED", {
      note: `Admin approved: ${note}`,
      actorId: adminId,
    });
    await notify({
      userId: p.companyId,
      kind: "PAYMENT",
      title: "Payment approved",
      body: `Your payment to ${p.freelancer.name} was approved. Confirm to fund escrow.`,
    });
  }
  return load(paymentId);
}

/**
 * Payer confirms with a locked quote -> RATE_LOCKED -> fund escrow on-chain ->
 * FUNDED -> SETTLING -> release -> COMPLETED. Broadcasts every hop.
 */
export async function confirmAndSettle(
  paymentId: string,
  quoteId: string,
  actorId: string,
): Promise<PaymentWithRelations> {
  let p = await load(paymentId);
  if (!["COMPLIANCE_CHECK", "RATE_LOCKED"].includes(p.state)) {
    throw ApiError.conflict(`Cannot confirm a payment in state ${p.state}`);
  }

  // Both parties must hold a valid credential (verified-party gate).
  const [payerOk, payeeOk] = await Promise.all([
    isVerified(p.companyId),
    isVerified(p.freelancerId),
  ]);
  if (!payerOk || !payeeOk) {
    throw ApiError.unprocessable("Both parties must be identity-verified before funding");
  }

  const lock = await consumeLockedQuote(quoteId);
  if (!lock) throw ApiError.badRequest("Unknown quote", "BAD_QUOTE");
  if (lock.expired) {
    if (p.state === "RATE_LOCKED") await transition(paymentId, "EXPIRED", { note: "Rate lock expired" });
    throw ApiError.conflict("Rate lock expired; request a new quote", "QUOTE_EXPIRED");
  }

  const rate = lock.fx.lockedRate!;
  const usdPer = fallback.usdPer as Record<string, number>;
  const fee = computeFeeMinor(p.srcAmountMinor, 1 / (usdPer[p.srcCurrency] ?? 1));
  const dstAmount = convertMinor(Math.max(0, p.srcAmountMinor - fee), rate);
  const escrowId = escrowIdFromUuid(p.id);

  if (p.state === "COMPLIANCE_CHECK") {
    await transition(paymentId, "RATE_LOCKED", {
      note: `Rate locked at ${rate} (${lock.fx.source})`,
      actorId,
      extra: { fxRateId: lock.fx.id, feeAmountMinor: fee, dstAmountMinor: dstAmount, escrowId },
    });
  } else {
    // Already RATE_LOCKED (admin-approved). Attach quote details.
    await prisma.payment.update({
      where: { id: paymentId },
      data: { fxRateId: lock.fx.id, feeAmountMinor: fee, dstAmountMinor: dstAmount, escrowId },
    });
  }

  // Fund escrow on-chain.
  const settlement = getSettlement();
  const payerWallet = await prisma.companyProfile.findUnique({ where: { userId: p.companyId } });
  const payeeUser = await prisma.user.findUnique({ where: { id: p.freelancerId } });
  const decisionHash = p.complianceDecisionId ? escrowIdFromUuid(p.complianceDecisionId) : escrowId;

  const funded = await settlement.fundEscrow({
    escrowId,
    payerKey: payerWallet?.demoWalletKey ?? "",
    payeeAddress: payeeUser?.walletAddress ?? "",
    amountMinor: p.srcAmountMinor,
    feeMinor: fee,
    complianceHash: decisionHash,
  });
  await transition(paymentId, "FUNDED", {
    note: "Escrow funded on-chain",
    txHash: funded.txHash,
    actorId,
    extra: { txHashFund: funded.txHash },
  });

  // Move into settling then release (auto-release on the happy path).
  await transition(paymentId, "SETTLING", { note: "Settling to payee" });
  const released = await settlement.releaseEscrow(escrowId);
  await transition(paymentId, "COMPLETED", {
    note: "Released to payee; off-ramp credited",
    txHash: released.txHash,
    extra: { txHashRelease: released.txHash },
  });

  await notify({
    userId: p.freelancerId,
    kind: "PAYMENT",
    title: "Payment received",
    body: `You received ${p.dstCurrency} ${formatMinor(dstAmount)} from ${p.company.name}.`,
  });
  await notify({
    userId: p.companyId,
    kind: "PAYMENT",
    title: "Payment completed",
    body: `Your payment to ${p.freelancer.name} settled successfully.`,
  });

  return load(paymentId);
}

/** Payer or platform refunds a funded (pre-completion) payment. */
export async function refund(paymentId: string, actorId: string): Promise<PaymentWithRelations> {
  const p = await load(paymentId);
  if (!["FUNDED", "SETTLING"].includes(p.state)) {
    throw ApiError.conflict(`Cannot refund a payment in state ${p.state}`);
  }
  const settlement = getSettlement();
  const escrowId = p.escrowId ?? escrowIdFromUuid(p.id);
  const res = await settlement.refundEscrow(escrowId);
  await transition(paymentId, "REFUNDED", {
    note: "Refunded to payer",
    txHash: res.txHash,
    actorId,
  });
  await notify({
    userId: p.companyId,
    kind: "PAYMENT",
    title: "Payment refunded",
    body: `Your escrow for the payment to ${p.freelancer.name} was refunded.`,
  });
  return load(paymentId);
}

/** Manual release for an admin/payer after a held FUNDED payment. */
export async function release(paymentId: string, actorId: string): Promise<PaymentWithRelations> {
  const p = await load(paymentId);
  if (p.state !== "FUNDED") throw ApiError.conflict(`Cannot release from ${p.state}`);
  const settlement = getSettlement();
  const escrowId = p.escrowId ?? escrowIdFromUuid(p.id);
  await transition(paymentId, "SETTLING", { note: "Settling to payee" });
  const res = await settlement.releaseEscrow(escrowId);
  await transition(paymentId, "COMPLETED", {
    note: "Released to payee",
    txHash: res.txHash,
    actorId,
    extra: { txHashRelease: res.txHash },
  });
  return load(paymentId);
}

export { load as loadPayment };
