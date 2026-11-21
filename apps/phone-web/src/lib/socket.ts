/**
 * socket.ts: the phone's rider WebSocket.
 *
 * Responsible for:
 * - Connecting to wss://<origin>/ws/rider?token=<token> (ws:// on http in dev; Vite proxies /ws).
 * - Sending `rider.hello { client: "phone" }` on every (re)open.
 * - Keepalive `ping` every 25 s (train networks drop idle sockets).
 * - Reconnecting with capped exponential backoff + jitter, and immediately when the tab
 *   becomes visible again or the network comes back.
 * - Validating incoming messages against the ServerToRider schema and handing typed events
 *   to the caller (useRide.ts). Unknown/invalid messages are dropped (logged in dev).
 *
 * Events received (ServerToRider): ride.state, match.found, match.cleared, mission.start,
 * mission.end, stamp.awarded.
 * Events sent (RiderToServer): rider.hello, ping, and rider.notNow via send() if the phone
 * ever offers "Not now" (glasses send it normally). rider.arrived is a glasses message.
 *
 * TODO:
 * - Agree on a close code for "bad token" with the worker and stop reconnecting on it.
 * - Confirm how the worker routes /ws/rider to a TrainRoom before the rider is checked in
 *   (see README "Protocol gaps"); until then, useRide reconnects after a check-in.
 */
import { ServerToRider, type RiderToServer } from "@questline/protocol";

export type SocketStatus = "idle" | "connecting" | "open" | "closed";

export interface RiderSocketHandlers {
  onEvent: (event: ServerToRider) => void;
  onStatus?: (status: SocketStatus) => void;
}

export interface RiderSocket {
  send: (msg: RiderToServer) => void;
  /** Drop the current connection and open a fresh one now (e.g. after checking in to a new trip). */
  reconnect: () => void;
  /** Close for good (sign out). */
  close: () => void;
}

const PING_MS = 25_000;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 15_000;

function riderSocketUrl(token: string): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws/rider?token=${encodeURIComponent(token)}`;
}

export function connectRiderSocket(token: string, handlers: RiderSocketHandlers): RiderSocket {
  let ws: WebSocket | null = null;
  let stopped = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const send = (msg: RiderToServer) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };

  const clearTimers = () => {
    if (retryTimer) clearTimeout(retryTimer);
    if (pingTimer) clearInterval(pingTimer);
    retryTimer = null;
    pingTimer = null;
  };

  const scheduleReconnect = () => {
    if (stopped || retryTimer) return;
    const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt) * (0.5 + Math.random() / 2);
    attempt += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      open();
    }, delay);
  };

  function open() {
    if (stopped) return;
    handlers.onStatus?.("connecting");
    const socket = new WebSocket(riderSocketUrl(token));
    ws = socket;

    socket.onopen = () => {
      attempt = 0;
      handlers.onStatus?.("open");
      send({ type: "rider.hello", client: "phone" });
      pingTimer = setInterval(() => send({ type: "ping" }), PING_MS);
    };

    socket.onmessage = (ev) => {
      let raw: unknown;
      try {
        raw = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      const parsed = ServerToRider.safeParse(raw);
      if (parsed.success) {
        handlers.onEvent(parsed.data);
      } else if (import.meta.env.DEV) {
        console.warn("[socket] dropped unknown message", raw, parsed.error.issues);
      }
    };

    socket.onclose = () => {
      if (ws !== socket) return; // a newer socket replaced this one
      clearTimers();
      ws = null;
      handlers.onStatus?.("closed");
      scheduleReconnect();
    };

    socket.onerror = () => socket.close();
  }

  const reconnect = () => {
    clearTimers();
    attempt = 0;
    const old = ws;
    ws = null;
    old?.close();
    open();
  };

  const onWake = () => {
    if (document.visibilityState === "visible" && !ws && !stopped) reconnect();
  };
  document.addEventListener("visibilitychange", onWake);
  window.addEventListener("online", onWake);

  open();

  return {
    send,
    reconnect,
    close: () => {
      stopped = true;
      clearTimers();
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
      const old = ws;
      ws = null;
      old?.close();
      handlers.onStatus?.("idle");
    },
  };
}
