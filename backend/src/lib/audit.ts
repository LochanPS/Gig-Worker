import { prisma } from "./db.js";

// Full AuditLog on every admin action and state transition (TRD 6).
export async function audit(params: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      beforeJson: (params.before ?? undefined) as object | undefined,
      afterJson: (params.after ?? undefined) as object | undefined,
    },
  });
}
