import type { FastifyInstance } from "fastify";
import type { AuthUser } from "../auth/rbac.js";
import { hub } from "./hub.js";

// GET /ws?token=<jwt> — authenticated websocket. Registers the socket with the
// hub so the orchestrator can push payment.state / alert.new / notification.new.
export async function wsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/ws", { websocket: true }, async (socket, req) => {
    const token = (req.query as { token?: string })?.token;
    if (!token) {
      socket.close(1008, "missing token");
      return;
    }
    let user: AuthUser;
    try {
      user = app.jwt.verify<AuthUser>(token);
    } catch {
      socket.close(1008, "invalid token");
      return;
    }
    hub.add({ socket, userId: user.id, role: user.role });
    socket.send(JSON.stringify({ type: "hello", userId: user.id, role: user.role }));
  });
}
