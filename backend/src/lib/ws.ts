// WebSocket hub — routes server events to the right viewers (BUILD_CONTRACTS §5).
// Connections are keyed by userId (from the JWT passed as ?token=). Admins also
// receive every alert/metrics event.
import type { WebSocket } from '@fastify/websocket';
import type { WsEvent } from '@gigbridge/shared';

interface Conn {
  socket: WebSocket;
  userId: string;
  role: string;
}

const conns = new Set<Conn>();

export function addConn(c: Conn): void {
  conns.add(c);
  c.socket.on('close', () => conns.delete(c));
}

// Send to specific users (payer, payee) and always to admins.
export function emitToUsers(userIds: string[], event: WsEvent): void {
  const targets = new Set(userIds);
  for (const c of conns) {
    if (targets.has(c.userId) || c.role === 'ADMIN') {
      safeSend(c.socket, event);
    }
  }
}

export function emitToAdmins(event: WsEvent): void {
  for (const c of conns) {
    if (c.role === 'ADMIN') safeSend(c.socket, event);
  }
}

export function emitToUser(userId: string, event: WsEvent): void {
  for (const c of conns) {
    if (c.userId === userId) safeSend(c.socket, event);
  }
}

function safeSend(socket: WebSocket, event: WsEvent): void {
  try {
    socket.send(JSON.stringify(event));
  } catch {
    /* dropped socket; close handler will clean it up */
  }
}
