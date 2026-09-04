// Notifications (FR-7.1). Rows were already being written by verification and
// disputes and pushed over the websocket, but nothing could read them back — a
// page reload lost every notification the user had not seen live. This owns the
// single write path (persist + push) and the reads behind it.
import type { Notification } from '@gigbridge/shared';
import { prisma } from '../../lib/db.js';
import { emitToUser } from '../../lib/ws.js';

// Pure — DB row to the shared wire shape.
export function publicNotification(n: {
  id: string;
  userId: string;
  kind: string;
  message: string;
  read: boolean;
  createdAt: Date;
}): Notification {
  return {
    id: n.id,
    userId: n.userId,
    kind: n.kind,
    message: n.message,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

// Persist a notification and push it to the recipient. The one write path —
// verification, disputes and anything added later all come through here, so a
// stored notification and a live one can never drift apart.
export async function notify(userId: string, kind: string, message: string): Promise<Notification> {
  const n = await prisma.notification.create({ data: { userId, kind, message } });
  const notification = publicNotification(n);
  emitToUser(userId, { type: 'notification.new', notification });
  return notification;
}

export async function listNotifications(userId: string, includeRead = false): Promise<Notification[]> {
  const rows = await prisma.notification.findMany({
    where: { userId, ...(includeRead ? {} : { read: false }) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map(publicNotification);
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}

// Mark one notification read. Scoped by userId in the update filter, so another
// user's id simply matches nothing rather than mutating a row they don't own.
export async function markRead(id: string, userId: string): Promise<Notification> {
  const { count } = await prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
  if (count === 0) {
    throw Object.assign(new Error('Notification not found'), { statusCode: 404 });
  }
  const n = await prisma.notification.findUniqueOrThrow({ where: { id } });
  return publicNotification(n);
}

export async function markAllRead(userId: string): Promise<{ marked: number }> {
  const { count } = await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  return { marked: count };
}
