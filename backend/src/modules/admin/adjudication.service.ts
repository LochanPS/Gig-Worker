// Adjudication metrics (CORRIDOR_ROADMAP item 2). The AI adjudicator triages every
// compliance FLAG into AUTO_CLEAR / AUTO_REJECT / ESCALATE — the claim being that
// only exceptions reach a human, so review scales. Nothing measured whether that
// was true.
//
// No schema change is needed: the adjudicator already writes an AuditLog row with
// action PAYMENT_ADJUDICATED_<ACTION> and stamps the ComplianceDecision with
// reviewedBy 'ai:<by>' and a reviewNote carrying the confidence and rationale.
// This reads those rows back.
import type { AdjudicationAction, AdjudicationSummary } from '@gigbridge/shared';
import { prisma } from '../../lib/db.js';

const ACTION_PREFIX = 'PAYMENT_ADJUDICATED_';

// Pure — the reviewNote is written as "[ACTION · 87% confidence] rationale".
// Parsing it here keeps the adjudicator's write format in one place to change.
export function parseReviewNote(note: string | null): { confidence: number | null; rationale: string | null } {
  if (!note) return { confidence: null, rationale: null };
  const m = note.match(/^\[[A-Z_]+\s*·\s*(\d+)%\s*confidence\]\s*(.*)$/s);
  if (!m) return { confidence: null, rationale: note };
  return { confidence: Number(m[1]) / 100, rationale: m[2].trim() || null };
}

// Pure — percentage of decisions the agent closed itself, one decimal.
export function autoHandledPercent(autoCleared: number, autoRejected: number, escalated: number): number {
  const total = autoCleared + autoRejected + escalated;
  if (total === 0) return 0;
  return +(((autoCleared + autoRejected) / total) * 100).toFixed(1);
}

export async function adjudicationSummary(limit = 20): Promise<AdjudicationSummary> {
  const rows = await prisma.auditLog.findMany({
    where: { action: { startsWith: ACTION_PREFIX } },
    orderBy: { at: 'desc' },
    take: 500,
  });

  const countOf = (a: AdjudicationAction) => rows.filter((r) => r.action === ACTION_PREFIX + a).length;
  const autoCleared = countOf('AUTO_CLEAR');
  const autoRejected = countOf('AUTO_REJECT');
  const escalated = countOf('ESCALATE');

  // Join the newest few back to their decision for the rationale the agent gave.
  const recentRows = rows.slice(0, limit);
  const paymentIds = recentRows.map((r) => r.entity.replace(/^payment:/, ''));
  const decisions = await prisma.complianceDecision.findMany({
    where: { paymentId: { in: paymentIds } },
    select: { paymentId: true, reviewedBy: true, reviewNote: true },
  });
  const byPayment = new Map(decisions.map((d) => [d.paymentId, d]));

  return {
    autoCleared,
    autoRejected,
    escalated,
    total: autoCleared + autoRejected + escalated,
    autoHandledPct: autoHandledPercent(autoCleared, autoRejected, escalated),
    recent: recentRows.map((r) => {
      const paymentId = r.entity.replace(/^payment:/, '');
      const d = byPayment.get(paymentId);
      const { confidence, rationale } = parseReviewNote(d?.reviewNote ?? null);
      return {
        paymentId,
        action: r.action.slice(ACTION_PREFIX.length) as AdjudicationAction,
        confidence,
        by: d?.reviewedBy?.replace(/^ai:/, '') ?? null,
        rationale,
        at: r.at.toISOString(),
      };
    }),
  };
}
