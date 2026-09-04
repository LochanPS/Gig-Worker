import type { WebSocket } from "@fastify/websocket";
import type { ServerEvent } from "@gigbridge/shared";

// In-process websocket hub. Sockets register under a userId (and role); events
// are pushed to specific users or broadcast to all admins.
interface Client {
  socket: WebSocket;
  userId: string;
  role: string;
}

class WsHub {
  private clients = new Set<Client>();

  add(client: Client): void {
    this.clients.add(client);
    client.socket.on("close", () => this.clients.delete(client));
  }

  private send(client: Client, event: ServerEvent): void {
    if (client.socket.readyState === 1 /* OPEN */) {
      client.socket.send(JSON.stringify(event));
    }
  }

  toUser(userId: string, event: ServerEvent): void {
    for (const c of this.clients) if (c.userId === userId) this.send(c, event);
  }

  toUsers(userIds: Array<string | null | undefined>, event: ServerEvent): void {
    const set = new Set(userIds.filter(Boolean) as string[]);
    for (const c of this.clients) if (set.has(c.userId)) this.send(c, event);
  }

  toAdmins(event: ServerEvent): void {
    for (const c of this.clients) if (c.role === "ADMIN") this.send(c, event);
  }

  broadcast(event: ServerEvent): void {
    for (const c of this.clients) this.send(c, event);
  }
}

export const hub = new WsHub();
