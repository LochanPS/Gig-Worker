// Alert service (step 7). Turns failed anomaly rules into durable Alert rows and
// pushes them live to admins. Called by the compliance engine after evaluation.
import type { RuleResult, AlertType, AlertSeverity } from '@gigbridge/shared';
import { prisma } from '../../lib/db.js';
import { emitToAdmins } from '../../lib/ws.js';
import { audit } from '../../lib/audit.js';
import { RULE_TO_ALERT } from './alert.mapping.js';

// Raise alerts for any failed rule that maps to the alert taxonomy.
export async function raiseAlertsFromRules(paymentId: string, ruleResults: RuleResult[]): Promise<void> {
  const failed = ruleResults.filter((r) => !r.passed && RULE_TO_ALERT[r.ruleId]);
  for (const r of failed) {
    const { type, severity } = RULE_TO_ALERT[r.ruleId];
    const alert = await prisma.alert.create({
      data: {
        type,
        severity,
        paymentId,
        details: { ruleId: r.ruleId, jurisdiction: r.jurisdiction, message: r.message } as never,
      },
    });
    await audit('agent', 'ALERT_RAISED', `alert:${alert.id}`, null, { type, paymentId });
    emitToAdmins({
      type: 'alert.new',
      alert: {
        id: alert.id,
        type: alert.type as AlertType,
        severity: alert.severity as AlertSeverity,
        paymentId: alert.paymentId,
        details: alert.details as Record<string, unknown>,
        resolved: alert.resolved,
        createdAt: alert.createdAt.toISOString(),
      },
    });
  }
}

export async function listAlerts(includeResolved = false) {
  const rows = await prisma.alert.findMany({
    where: includeResolved ? {} : { resolved: false },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map((a) => ({
    id: a.id,
    type: a.type,
    severity: a.severity,
    paymentId: a.paymentId,
    details: a.details,
    resolved: a.resolved,
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function resolveAlert(id: string, adminId: string) {
  const a = await prisma.alert.update({ where: { id }, data: { resolved: true } });
  await audit(adminId, 'ALERT_RESOLVED', `alert:${id}`, { resolved: false }, { resolved: true });
  return a;
}
