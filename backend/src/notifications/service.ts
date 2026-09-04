import { prisma } from "../lib/db.js";
import { hub } from "../ws/hub.js";
import type { NotificationDTO } from "@gigbridge/shared";

export async function notify(params: {
  userId: string;
  kind: string;
  title: string;
  body: string;
}): Promise<NotificationDTO> {
  const n = await prisma.notification.create({ data: params });
  const dto: NotificationDTO = {
    id: n.id,
    userId: n.userId,
    kind: n.kind,
    title: n.title,
    body: n.body,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
  hub.toUser(params.userId, { type: "notification.new", notification: dto });
  return dto;
}
