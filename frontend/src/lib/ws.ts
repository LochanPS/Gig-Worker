// WebSocket hook — subscribes to live payment.state / alert.new / notification.new.
import { useEffect, useRef } from 'react';
import type { WsEvent } from '@gigbridge/shared';
import { getToken } from './api.js';

export function useWs(onEvent: (e: WsEvent) => void) {
  const cb = useRef(onEvent);
  cb.current = onEvent;
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    // Same origin in dev (Vite proxy). In prod, VITE_API_BASE points at the
    // backend origin; derive the ws:// host from it.
    const apiBase = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
    let wsUrl: string;
    if (apiBase) {
      wsUrl = apiBase.replace(/^http/, 'ws') + `/api/v1/ws?token=${token}`;
    } else {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      wsUrl = `${proto}://${location.host}/api/v1/ws?token=${token}`;
    }
    const sock = new WebSocket(wsUrl);
    sock.onmessage = (m) => {
      try { cb.current(JSON.parse(m.data) as WsEvent); } catch { /* ignore */ }
    };
    return () => sock.close();
  }, []);
}
