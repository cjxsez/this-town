/**
 * socket.ts (kiosk-web): the kiosk screen's WebSocket to the train's TrainRoom.
 *
 * Connects to wss://<host>/ws/kiosk/:car?key=<key>&role=screen and on open sends
 * { type: "kiosk.hello", car, role: "screen" } (no hw field; that is the Pi's).
 *
 * Receives (ServerToKiosk): kiosk.idle, pair.incoming, mission.show, celebrate,
 *   pair.cleared. nfc.write is for the Pi agent (apps/kiosk-pi) and is dropped here.
 * Sends (KioskToServer): kiosk.hello, ping (every PING_MS). Never nfc.written (Pi only).
 *
 * Reconnect: exponential backoff, 1 s up to 15 s, forever — except:
 *   WS_CLOSE.badAuth / forbidden → stop and report "rejected" (bad key / unknown car)
 *   WS_CLOSE.tripChanged → reconnect immediately into the new trip's room
 * After RELOAD_AFTER_OFFLINE_MS continuous offline, reload the page (wedged Chromium).
 *
 * A bad key is often an HTTP 401 before the upgrade (no close code); that still lands
 * in onclose as an abnormal close and keeps retrying until a real WS_CLOSE arrives.
 */
import { WS_CLOSE, type KioskToServer, type ServerToKiosk } from "@questline/protocol";
import type { KioskConfig } from "./config";

/** Everything the screen cares about: ServerToKiosk minus the Pi-only nfc.write. */
export type ScreenEvent = Exclude<ServerToKiosk, { type: "nfc.write" } | { type: "pong" }>;
export type KioskSocketStatus = "connecting" | "open" | "offline" | "rejected";

export interface KioskSocketOptions {
  config: KioskConfig;
  onEvent: (event: ScreenEvent) => void;
  onStatus: (status: KioskSocketStatus) => void;
}

export interface KioskSocket {
  close: () => void;
}

const PING_MS = 25_000;
const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 15_000;
/** Wedged Chromium recovery: reload if we have been offline this long. */
const RELOAD_AFTER_OFFLINE_MS = 5 * 60_000;

function wsUrl({ car, key }: KioskConfig): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const qs = new URLSearchParams({ key, role: "screen" });
  return `${proto}//${location.host}/ws/kiosk/${encodeURIComponent(car)}?${qs.toString()}`;
}

export function connectKioskSocket(opts: KioskSocketOptions): KioskSocket {
  let ws: WebSocket | null = null;
  let closed = false;
  let failures = 0;
  let pingTimer: number | undefined;
  let retryTimer: number | undefined;
  let offlineSince: number | null = null;
  let reloadTimer: number | undefined;

  function send(msg: KioskToServer) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function markOffline() {
    if (offlineSince === null) {
      offlineSince = Date.now();
      window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => {
        if (!closed) location.reload();
      }, RELOAD_AFTER_OFFLINE_MS);
    }
    opts.onStatus("offline");
  }

  function clearOfflineWatch() {
    offlineSince = null;
    window.clearTimeout(reloadTimer);
    reloadTimer = undefined;
  }

  function scheduleReconnect(immediate = false) {
    if (closed) return;
    failures += 1;
    markOffline();
    const delay = immediate ? 0 : Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** (failures - 1));
    retryTimer = window.setTimeout(open, delay);
  }

  function reject() {
    closed = true;
    window.clearInterval(pingTimer);
    window.clearTimeout(retryTimer);
    clearOfflineWatch();
    opts.onStatus("rejected");
  }

  function open() {
    if (closed) return;
    opts.onStatus(failures === 0 ? "connecting" : "offline");

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl(opts.config));
    } catch {
      scheduleReconnect();
      return;
    }
    ws = socket;

    socket.onopen = () => {
      failures = 0;
      clearOfflineWatch();
      opts.onStatus("open");
      send({ type: "kiosk.hello", car: opts.config.car, role: "screen" });
      window.clearInterval(pingTimer);
      pingTimer = window.setInterval(() => send({ type: "ping" }), PING_MS);
    };

    socket.onmessage = (e: MessageEvent) => {
      if (typeof e.data !== "string") return;
      let msg: ServerToKiosk;
      try {
        msg = JSON.parse(e.data) as ServerToKiosk;
      } catch {
        console.warn("[kiosk socket] bad message", e.data);
        return;
      }
      if (msg.type === "nfc.write" || msg.type === "pong") return; // nfc.write is the Pi agent's job
      opts.onEvent(msg);
    };

    socket.onclose = (e: CloseEvent) => {
      window.clearInterval(pingTimer);
      ws = null;
      if (closed) return;
      if (e.code === WS_CLOSE.badAuth || e.code === WS_CLOSE.forbidden) {
        console.error("[kiosk socket] rejected", e.code, e.reason);
        reject();
        return;
      }
      if (e.code === WS_CLOSE.tripChanged) {
        scheduleReconnect(true);
        return;
      }
      scheduleReconnect();
    };

    socket.onerror = () => {};
  }

  open();

  return {
    close() {
      closed = true;
      window.clearInterval(pingTimer);
      window.clearTimeout(retryTimer);
      clearOfflineWatch();
      ws?.close(1000, "client closing");
      ws = null;
    },
  };
}
