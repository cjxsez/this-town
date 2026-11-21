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
 * Reconnect: exponential backoff, 1 s up to 15 s, forever. The kiosk runs unattended on
 * a phone hotspot, so drops are expected.
 *
 * TODO:
 * - Agree a close code for a bad key with the worker (not in packages/protocol) and show
 *   it on the Disconnected screen instead of retrying forever.
 * - Reload the page after N minutes disconnected (recovers from a wedged Chromium).
 */
import type { KioskToServer, ServerToKiosk } from "@questline/protocol";
import type { KioskConfig } from "./config";

/** Everything the screen cares about: ServerToKiosk minus the Pi-only nfc.write. */
export type ScreenEvent = Exclude<ServerToKiosk, { type: "nfc.write" }>;
export type KioskSocketStatus = "connecting" | "open" | "offline";

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

  function send(msg: KioskToServer) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function scheduleReconnect() {
    if (closed) return;
    failures += 1;
    opts.onStatus("offline");
    const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** (failures - 1));
    retryTimer = window.setTimeout(open, delay);
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
      if (msg.type === "nfc.write") return; // Pi agent's job
      opts.onEvent(msg);
    };

    socket.onclose = () => {
      window.clearInterval(pingTimer);
      ws = null;
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
      ws?.close(1000, "client closing");
      ws = null;
    },
  };
}
