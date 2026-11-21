/**
 * socket.ts (glasses-web): the rider WebSocket, with reconnect and a polling fallback.
 *
 * Connects to wss://<host>/ws/rider?token=<token> (same socket type as phone-web) and on
 * open sends { type: "rider.hello", client: "glasses" }.
 *
 * Receives (ServerToRider): ride.state, match.found, match.cleared, mission.start,
 *   mission.end, stamp.awarded. Messages are trusted (protocol README), not re-validated.
 * Sends (RiderToServer): rider.hello, rider.arrived, rider.notNow, ping (every PING_MS).
 *
 * Reconnect: exponential backoff, 1 s up to 15 s. Status goes "connecting" -> "open",
 * and "offline" while retrying after a drop.
 *
 * Fallback (decisions.md "Still open"): if WebSockets never open in the glasses browser
 * (no WebSocket global, or WS_FAILS_BEFORE_POLL failures without ever opening), poll
 * GET /api/ride/state (Bearer token) every POLL_MS and emit synthetic ride.state events.
 * Status is "polling" in that mode.
 *
 * Auth: close codes 4001/4003, or a 401 from the poll, call onAuthFailed so App can clear
 * the token and show the link code again.
 *
 * TODO:
 * - Agree close codes for bad/expired token with the worker (not in packages/protocol).
 * - GET /api/ride/state has no response schema in api.ts; assumed to return RideState.
 *   It also carries no current match or mission, so polling mode cannot show a match card.
 * - In polling mode, send() returns false: there are no REST routes for rider.arrived /
 *   rider.notNow yet. Add them (or a REST "Not now") if WebSockets turn out to be broken.
 * - While polling, retry the WebSocket every few minutes in case it was transient.
 * - Pause/resume on document visibilitychange if the glasses browser backgrounds the page.
 */
import type { RideState, RiderToServer, ServerToRider } from "@questline/protocol";

export type MatchFound = Extract<ServerToRider, { type: "match.found" }>;
export type SocketStatus = "connecting" | "open" | "polling" | "offline";

export interface RiderSocketOptions {
  token: string;
  onEvent: (event: ServerToRider) => void;
  onStatus: (status: SocketStatus) => void;
  onAuthFailed: () => void;
}

export interface RiderSocket {
  /** Returns false if the message could not be sent (not open, or polling mode). */
  send: (msg: RiderToServer) => boolean;
  /** Retry the connection immediately (Offline screen "retry"). */
  retryNow: () => void;
  close: () => void;
}

const PING_MS = 25_000;
const POLL_MS = 3_000;
const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 15_000;
const WS_FAILS_BEFORE_POLL = 3;
const AUTH_CLOSE_CODES = new Set([4001, 4003]);

function wsUrl(token: string): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws/rider?token=${encodeURIComponent(token)}`;
}

export function connectRiderSocket(opts: RiderSocketOptions): RiderSocket {
  let ws: WebSocket | null = null;
  let closed = false;
  let everOpened = false;
  let failures = 0;
  let pingTimer: number | undefined;
  let retryTimer: number | undefined;
  let pollTimer: number | undefined;

  function clearTimers() {
    window.clearInterval(pingTimer);
    window.clearTimeout(retryTimer);
    window.clearInterval(pollTimer);
  }

  function scheduleReconnect() {
    if (closed) return;
    failures += 1;
    if (!everOpened && failures >= WS_FAILS_BEFORE_POLL) {
      startPolling();
      return;
    }
    const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** (failures - 1));
    opts.onStatus(everOpened ? "offline" : "connecting");
    retryTimer = window.setTimeout(open, delay);
  }

  function open() {
    if (closed) return;
    if (typeof WebSocket === "undefined") {
      startPolling();
      return;
    }
    opts.onStatus(everOpened ? "offline" : "connecting");

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl(opts.token));
    } catch {
      scheduleReconnect();
      return;
    }
    ws = socket;

    socket.onopen = () => {
      everOpened = true;
      failures = 0;
      opts.onStatus("open");
      sendRaw({ type: "rider.hello", client: "glasses" });
      window.clearInterval(pingTimer);
      pingTimer = window.setInterval(() => sendRaw({ type: "ping" }), PING_MS);
    };

    socket.onmessage = (e: MessageEvent) => {
      if (typeof e.data !== "string") return;
      try {
        opts.onEvent(JSON.parse(e.data) as ServerToRider);
      } catch {
        console.warn("[socket] bad message", e.data);
      }
    };

    socket.onclose = (e: CloseEvent) => {
      window.clearInterval(pingTimer);
      ws = null;
      if (closed) return;
      if (AUTH_CLOSE_CODES.has(e.code)) {
        closed = true;
        opts.onAuthFailed();
        return;
      }
      scheduleReconnect();
    };

    // onerror is always followed by onclose; reconnect is handled there.
    socket.onerror = () => {};
  }

  function startPolling() {
    if (closed) return;
    opts.onStatus("polling");
    const poll = async () => {
      try {
        const res = await fetch("/api/ride/state", {
          headers: { Authorization: `Bearer ${opts.token}` },
        });
        if (res.status === 401 || res.status === 403) {
          close();
          opts.onAuthFailed();
          return;
        }
        if (!res.ok) return;
        const state = (await res.json()) as RideState;
        opts.onEvent({ type: "ride.state", state });
      } catch {
        // network blip: try again next tick
      }
    };
    void poll();
    window.clearInterval(pollTimer);
    pollTimer = window.setInterval(poll, POLL_MS);
  }

  function sendRaw(msg: RiderToServer): boolean {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }

  function retryNow() {
    if (closed || (ws && ws.readyState === WebSocket.OPEN)) return;
    clearTimers();
    open();
  }

  function close() {
    closed = true;
    clearTimers();
    ws?.close(1000, "client closing");
    ws = null;
  }

  open();
  return { send: sendRaw, retryNow, close };
}
