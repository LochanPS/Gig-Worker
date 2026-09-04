import type { Prisma } from "@prisma/client";
import type {
  ComplianceDecisionDTO,
  PaymentDTO,
  RuleResult,
  TimelineEntry,
} from "@gigbridge/shared";

export type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: {
    company: true;
    freelancer: true;
    timeline: true;
    complianceDecision: true;
  };
}>;

export function toComplianceDTO(
  d: NonNullable<PaymentWithRelations["complianceDecision"]>,
): ComplianceDecisionDTO {
  return {
    id: d.id,
    verdict: d.verdict,
    ruleResults: (d.ruleResultsJson as unknown as RuleResult[]) ?? [],
    agentExplanation: d.agentExplanation,
    anchorTxHash: d.anchorTxHash,
    reviewedBy: d.reviewedBy,
    reviewNote: d.reviewNote,
    createdAt: d.createdAt.toISOString(),
  };
}

export function toPaymentDTO(p: PaymentWithRelations): PaymentDTO {
  const timeline: TimelineEntry[] = [...p.timeline]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((t) => ({
      state: t.state,
      at: t.at.toISOString(),
      note: t.note ?? undefined,
      txHash: t.txHash ?? undefined,
    }));

  return {
    id: p.id,
    companyId: p.companyId,
    freelancerId: p.freelancerId,
    payerName: p.company.name,
    payeeName: p.freelancer.name,
    srcCurrency: p.srcCurrency as PaymentDTO["srcCurrency"],
    dstCurrency: p.dstCurrency as PaymentDTO["dstCurrency"],
    srcAmountMinor: p.srcAmountMinor,
    dstAmountMinor: p.dstAmountMinor,
    feeAmountMinor: p.feeAmountMinor,
    purposeCode: p.purposeCode as PaymentDTO["purposeCode"],
    invoiceRef: p.invoiceRef,
    state: p.state,
    escrowId: p.escrowId,
    txHashFund: p.txHashFund,
    txHashRelease: p.txHashRelease,
    timeline,
    compliance: p.complianceDecision ? toComplianceDTO(p.complianceDecision) : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export const paymentInclude = {
  company: true,
  freelancer: true,
  timeline: true,
  complianceDecision: true,
} as const;
