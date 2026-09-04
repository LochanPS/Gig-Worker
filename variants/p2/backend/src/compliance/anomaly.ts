import { prisma } from "../lib/db.js";
import { hub } from "../ws/hub.js";
import type { AlertDTO, AlertType, RuleResult, RuleSeverity } from "@gigbridge/shared";

// Map triggered anomaly rules to Alert rows for the admin alerts page.
const RULE_TO_ALERT: Record<string, AlertType> = {
  "GB-VEL-001": "VELOCITY",
  "GB-STR-001": "STRUCTURING",
  "GB-OUT-001": "OUTLIER",
  "US-OFAC-001": "SANCTIONS",
};

function toAlertDTO(a: {
  id: string;
  type: AlertType;
  paymentId: string | null;
  severity: string;
  detailsJson: unknown;
  resolved: boolean;
  createdAt: Date;
}): AlertDTO {
  return {
    id: a.id,
    type: a.type,
    paymentId: a.paymentId,
    severity: a.severity as RuleSeverity,
    details: (a.detailsJson ?? {}) as Record<string, unknown>,
    resolved: a.resolved,
    createdAt: a.createdAt.toISOString(),
  };
}

/**
 * Persist Alert rows for any triggered anomaly/sanctions rules and push
 * alert.new to admins. Returns the created alerts.
 */
export async function raiseAlerts(
  paymentId: string,
  results: RuleResult[],
): Promise<AlertDTO[]> {
  const created: AlertDTO[] = [];
  for (const r of results) {
    if (!r.triggered) continue;
    const type = RULE_TO_ALERT[r.id];
    if (!type) continue;
    const row = await prisma.alert.create({
      data: {
        type,
        paymentId,
        severity: r.severity,
        detailsJson: { ruleId: r.id, message: r.message, legalRef: r.legalRef },
      },
    });
    const dto = toAlertDTO(row);
    created.push(dto);
    hub.toAdmins({ type: "alert.new", alert: dto });
  }
  return created;
}
