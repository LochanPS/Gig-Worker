// Single WebSocket connection with typed dispatch and backoff reconnect.
//
// PATH DISCREPANCY (raised with P2 in INTEGRATION_LOG.txt):
//   mock server serves       /ws
//   real backend serves      /api/v1/ws   (route registered inside the prefix)
//   BUILD_CONTRACTS says     /ws
// Flip this single constant when the real backend lands.
export const WS_PATH = '/ws';

import type { WsEvent } from '@gigbridge/shared';

export type ConnState = 'connecting' | 'open' | 'closed';

type Listener = (event: WsEvent) => void;
type StateListener = (state: ConnState) => void;

class Socket {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private stateListeners = new Set<StateListener>();
  private attempt = 0;
  private timer: number | null = null;
  private token: string | null = null;
  private manualClose = false;
  private _state: ConnState = 'closed';

  get state() {
    return this._state;
  }

  private setState(next: ConnState) {
    this._state = next;
    this.stateListeners.forEach((l) => l(next));
  }

  connect(token: string) {
    this.token = token;
    this.manualClose = false;
    this.open();
  }

  private open() {
    if (!this.token) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    this.setState('connecting');
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${window.location.host}${WS_PATH}?token=${encodeURIComponent(this.token)}`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.attempt = 0;
      this.setState('open');
    };
    this.ws.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as WsEvent;
        this.listeners.forEach((l) => l(parsed));
      } catch {
        /* ignore malformed frame */
      }
    };
    this.ws.onclose = () => {
      this.setState('closed');
      if (!this.manualClose) this.scheduleReconnect();
    };
    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect() {
    if (this.timer !== null) return;
    const delay = Math.min(1000 * 2 ** this.attempt, 10_000);
    this.attempt += 1;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.open();
    }, delay);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this._state);
    return () => this.stateListeners.delete(listener);
  }

  close() {
    this.manualClose = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.token = null;
    this.setState('closed');
  }
}

export const socket = new Socket();
