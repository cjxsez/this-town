/**
 * socket.ts (glasses-web): the rider WebSocket, with reconnect and a polling fallback.
 *
 * Connects to wss://<host>/ws/rider?token=<token> (same socket type as phone-web) and on
 * open sends { type: "rider.hello", client: "glasses" }.
 *
 * Receives (ServerToRider): ride.state, match.found, match.cleared, mission.start,
 *   mission.end, stamp.awarded, ride.snapshot. Messages are trusted (protocol README).
 * Sends (RiderToServer): rider.hello, rider.arrived, rider.notNow, ping (every PING_MS).
 *
 * Close codes (WS_CLOSE from @questline/protocol):
 *   badAuth (4001)     clear token via onAuthFailed
 *   forbidden (4003)   stop reconnecting
 *   tripChanged (4002) reconnect immediately
 *   noRide (4009)      fall back to polling GET /api/ride/state
 *
 * Polling mode: send() maps rider.arrived / rider.notNow to their REST twins.
 * While polling, retry the WebSocket every WS_RETRY_WHILE_POLLING_MS.
 * Pause when document.hidden; resume on visible.
 */
import { WS_CLOSE, type RideSnapshot, type RiderToServer, type ServerToRider } from "@questline/protocol";

export type MatchFound = Extract<ServerToRider, { type: "match.found" }>;
export type SocketStatus = "connecting" | "open" | "polling" | "offline";

export interface RiderSocketOptions {
  token: string;
  onEvent: (event: ServerToRider) => void;
  onStatus: (status: SocketStatus) => void;
  onAuthFailed: () => void;
}

export interface RiderSocket {
  /** false if the message could not be sent. */
  send: (msg: RiderToServer) => Promise<boolean>;
  /** Retry the connection immediately (Offline screen "retry"). */
  retryNow: () => void;
  close: () => void;
}

const PING_MS = 25_000;
const POLL_MS = 3_000;
const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 15_000;
const WS_FAILS_BEFORE_POLL = 3;
const WS_RETRY_WHILE_POLLING_MS = 3 * 60_000;

function wsUrl(token: string): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws/rider?token=${encodeURIComponent(token)}`;
}

export function connectRiderSocket(opts: RiderSocketOptions): RiderSocket {
  let ws: WebSocket | null = null;
  let closed = false;
  let paused = false;
  let everOpened = false;
  let failures = 0;
  let mode: "ws" | "poll" = "ws";
  let stopReconnect = false;
  let pingTimer: number | undefined;
  let retryTimer: number | undefined;
  let pollTimer: number | undefined;
  let wsRetryWhilePollTimer: number | undefined;

  function clearTimers() {
    window.clearInterval(pingTimer);
    window.clearTimeout(retryTimer);
    window.clearInterval(pollTimer);
    window.clearInterval(wsRetryWhilePollTimer);
  }

  function scheduleReconnect(immediate = false) {
    if (closed || paused || stopReconnect) return;
    failures += 1;
    if (!everOpened && failures >= WS_FAILS_BEFORE_POLL) {
      startPolling();
      return;
    }
    const delay = immediate ? 0 : Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** (failures - 1));
    opts.onStatus(everOpened ? "offline" : "connecting");
    retryTimer = window.setTimeout(open, delay);
  }

  function open() {
    if (closed || paused || stopReconnect) return;
    if (typeof WebSocket === "undefined") {
      startPolling();
      return;
    }
    mode = "ws";
    window.clearInterval(pollTimer);
    window.clearInterval(wsRetryWhilePollTimer);
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
      mode = "ws";
      opts.onStatus("open");
      void sendRaw({ type: "rider.hello", client: "glasses" });
      window.clearInterval(pingTimer);
      pingTimer = window.setInterval(() => void sendRaw({ type: "ping" }), PING_MS);
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
      if (closed || paused) return;
      if (e.code === WS_CLOSE.badAuth) {
        closed = true;
        stopReconnect = true;
        opts.onAuthFailed();
        return;
      }
      if (e.code === WS_CLOSE.forbidden) {
        stopReconnect = true;
        opts.onStatus("offline");
        return;
      }
      if (e.code === WS_CLOSE.noRide) {
        startPolling();
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

  function startPolling() {
    if (closed || paused) return;
    mode = "poll";
    opts.onStatus("polling");
    const poll = async () => {
      if (closed || paused || mode !== "poll") return;
      try {
        const res = await fetch("/api/ride/state", {
          headers: { Authorization: `Bearer ${opts.token}` },
        });
        if (res.status === 401) {
          close();
          opts.onAuthFailed();
          return;
        }
        if (res.status === 403) {
          stopReconnect = true;
          clearTimers();
          opts.onStatus("offline");
          return;
        }
        if (!res.ok) return;
        const snapshot = (await res.json()) as RideSnapshot;
        opts.onEvent({ type: "ride.snapshot", snapshot });
      } catch {
        // network blip: try again next tick
      }
    };
    void poll();
    window.clearInterval(pollTimer);
    pollTimer = window.setInterval(poll, POLL_MS);
    // While polling, retry the WebSocket every ~3 minutes.
    window.clearInterval(wsRetryWhilePollTimer);
    wsRetryWhilePollTimer = window.setInterval(() => {
      if (closed || paused || mode !== "poll") return;
      open();
    }, WS_RETRY_WHILE_POLLING_MS);
  }

  async function sendRest(msg: RiderToServer): Promise<boolean> {
    if (msg.type === "rider.arrived" || msg.type === "rider.notNow") {
      const path = msg.type === "rider.arrived" ? "/api/ride/arrived" : "/api/ride/not-now";
      try {
        const res = await fetch(path, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${opts.token}`,
            "content-type": "application/json",
          },
          body: "{}",
        });
        if (res.status === 401) {
          close();
          opts.onAuthFailed();
          return false;
        }
        return res.ok;
      } catch {
        return false;
      }
    }
    return false;
  }

  async function sendRaw(msg: RiderToServer): Promise<boolean> {
    if (mode === "poll") return sendRest(msg);
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }

  function pause() {
    paused = true;
    clearTimers();
    if (ws) {
      ws.close(1000, "hidden");
      ws = null;
    }
  }

  function resume() {
    if (closed) return;
    paused = false;
    if (mode === "poll") startPolling();
    else open();
  }

  function onVisibility() {
    if (document.hidden) pause();
    else resume();
  }

  function retryNow() {
    if (closed || (ws && ws.readyState === WebSocket.OPEN)) return;
    stopReconnect = false;
    clearTimers();
    open();
  }

  function close() {
    closed = true;
    document.removeEventListener("visibilitychange", onVisibility);
    clearTimers();
    ws?.close(1000, "client closing");
    ws = null;
  }

  document.addEventListener("visibilitychange", onVisibility);
  if (document.hidden) {
    paused = true;
    opts.onStatus("offline");
  } else {
    open();
  }

  return { send: sendRaw, retryNow, close };
}
