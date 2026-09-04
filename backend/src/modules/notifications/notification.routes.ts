// Notification routes (FR-7.1). Always scoped to the signed-in user.
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/auth.routes.js';
import { listNotifications, unreadCount, markRead, markAllRead } from './notification.service.js';

export async function notificationRoutes(app: FastifyInstance) {
  // Unread by default; ?all=true for the full bell menu history.
  app.get('/notifications', { preHandler: [requireAuth] }, async (req) => {
    const all = (req.query as { all?: string }).all === 'true';
    return listNotifications(req.user.sub, all);
  });

  app.get('/notifications/unread-count', { preHandler: [requireAuth] }, async (req) => ({
    count: await unreadCount(req.user.sub),
  }));

  app.post('/notifications/:id/read', { preHandler: [requireAuth] }, async (req) =>
    markRead((req.params as { id: string }).id, req.user.sub),
  );

  app.post('/notifications/read-all', { preHandler: [requireAuth] }, async (req) => markAllRead(req.user.sub));
}
