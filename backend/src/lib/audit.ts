// Append-only audit trail (NFR-5). Every admin action and state transition logs here.
import { prisma } from './db.js';

export async function audit(
  actor: string,
  action: string,
  entity: string,
  before?: unknown,
  after?: unknown,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actor,
      action,
      entity,
      before: (before ?? null) as never,
      after: (after ?? null) as never,
    },
  });
}
