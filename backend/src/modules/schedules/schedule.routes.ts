// Recurring payout routes. Company-only. run-due is a manual trigger so the demo
// doesn't depend on the background tick.
import type { FastifyInstance } from 'fastify';
import { createScheduleSchema } from '@gigbridge/shared';
import { requireRole } from '../auth/auth.routes.js';
import { createSchedule, setScheduleActive, listSchedules, runDueSchedules } from './schedule.service.js';

export async function scheduleRoutes(app: FastifyInstance) {
  app.post('/schedules', { preHandler: [requireRole('COMPANY')] }, async (req) => {
    const input = createScheduleSchema.parse(req.body);
    return createSchedule(req.user.sub, input);
  });

  app.get('/schedules', { preHandler: [requireRole('COMPANY')] }, async (req) => listSchedules(req.user.sub));

  app.post('/schedules/:id/pause', { preHandler: [requireRole('COMPANY')] }, async (req) =>
    setScheduleActive((req.params as { id: string }).id, req.user.sub, false),
  );

  app.post('/schedules/:id/resume', { preHandler: [requireRole('COMPANY')] }, async (req) =>
    setScheduleActive((req.params as { id: string }).id, req.user.sub, true),
  );

  // Fire this company's due schedules now (demo convenience; also runs on the tick).
  app.post('/schedules/run-due', { preHandler: [requireRole('COMPANY')] }, async (req) => runDueSchedules(req.user.sub));
}
