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
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const sock = new WebSocket(`${proto}://${location.host}/api/v1/ws?token=${token}`);
    sock.onmessage = (m) => {
      try { cb.current(JSON.parse(m.data) as WsEvent); } catch { /* ignore */ }
    };
    return () => sock.close();
  }, []);
}
