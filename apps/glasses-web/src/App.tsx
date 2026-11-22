/**
 * App.tsx (glasses-web): the HUD screen state machine.
 *
 * No router: the whole app lives at /g/ and switches screens on socket events.
 *
 *   no token in localStorage           -> LinkCode   (lib/link.ts, POST/GET /api/glasses/code)
 *   linked, socket "offline"           -> Offline    (overlays whatever screen was current)
 *   ride.state                         -> updates ride info; idle if status off/riding
 *                                         while a stale match/mission is showing
 *   match.found                        -> MatchCard
 *   rider presses "I'm here"           -> sends rider.arrived, card shows "Waiting for…"
 *   rider presses "Not now" / back     -> sends rider.notNow, Idle (optimistic)
 *   match.cleared (same matchId)       -> Idle
 *   mission.start                      -> Mission
 *   mission.end  time-up | cancelled   -> Idle
 *   mission.end  stamped               -> stay, stamp.awarded follows
 *   stamp.awarded                      -> Stamp, auto-dismiss -> Idle
 *   socket auth failure (4001/4003/401)-> clear token, LinkCode
 *
 * Socket: /ws/rider?token= (lib/socket.ts), sends rider.hello {client:"glasses"} on open.
 * Reload mid-match restores from ride.snapshot.match / mission (protocol RideSnapshot).
 */
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { Mission as MissionModel, Partner, RideState, ServerToRider, Stamp as StampModel } from "@questline/protocol";
import { setServerNow } from "./lib/clock";
import { clearToken, loadToken } from "./lib/link";
import { connectRiderSocket, type MatchFound, type RiderSocket, type SocketStatus } from "./lib/socket";
import { useWakeLock } from "./lib/wakeLock";
import { Idle } from "./screens/Idle";
import { LinkCode } from "./screens/LinkCode";
import { MatchCard } from "./screens/MatchCard";
import { Mission } from "./screens/Mission";
import { Offline } from "./screens/Offline";
import { Stamp } from "./screens/Stamp";

type Screen =
  | { name: "idle" }
  | { name: "match"; match: MatchFound; arrived: boolean }
  | { name: "mission"; mission: MissionModel; partner: Partner | null; tapped: 0 | 1 | 2 }
  | { name: "stamp"; stamp: StampModel };

interface State {
  token: string | null;
  status: SocketStatus;
  screen: Screen;
  ride: RideState | null;
  /** Epoch ms of the next stop, computed when ride.state arrived. */
  nextStopAt: number | null;
  /** Current match, kept so Mission can show the partner. */
  match: MatchFound | null;
  /** When mission.end reason=stamped arrived; Idle if stamp.awarded never follows. */
  stampedAt: number | null;
  sendError: string | null;
}

type Action =
  | { type: "linked"; token: string }
  | { type: "unlinked" }
  | { type: "status"; status: SocketStatus }
  | { type: "event"; event: ServerToRider; at: number }
  | { type: "arrived" }
  | { type: "notNow" }
  | { type: "stampDismissed" }
  | { type: "stampTimeout" }
  | { type: "sendError"; message: string | null };

const IDLE: Screen = { name: "idle" };

function initState(): State {
  return {
    token: loadToken(),
    status: "connecting",
    screen: IDLE,
    ride: null,
    nextStopAt: null,
    match: null,
    stampedAt: null,
    sendError: null,
  };
}

function onEvent(state: State, event: ServerToRider, at: number): State {
  switch (event.type) {
    case "ride.snapshot": {
      // Sent after rider.hello and returned by the polling fallback: redraw from scratch.
      setServerNow(event.snapshot.serverNow, at);
      const { state: ride, match, mission } = event.snapshot;
      const nextStopAt = ride.nextStopEtaSec === null ? null : at + ride.nextStopEtaSec * 1000;
      let screen: Screen = IDLE;
      if (mission) screen = { name: "mission", mission, partner: match?.partner ?? null, tapped: 0 };
      else if (match) screen = { name: "match", match: { type: "match.found", ...match }, arrived: false };
      if (state.screen.name === "stamp") screen = state.screen; // let the celebration finish
      return {
        ...state,
        ride,
        nextStopAt,
        match: match ? { type: "match.found", ...match } : null,
        screen,
        stampedAt: null,
      };
    }
    case "stamp.progress":
      if (state.screen.name !== "mission") return state;
      return {
        ...state,
        screen: { ...state.screen, tapped: event.tapped === 2 ? 2 : 1 },
      };
    case "pong":
      return state;
    case "ride.state": {
      setServerNow(event.serverNow, at);
      const ride = event.state;
      const nextStopAt = ride.nextStopEtaSec === null ? null : at + ride.nextStopEtaSec * 1000;
      const stale =
        (ride.status === "off" || ride.status === "riding") &&
        (state.screen.name === "match" || state.screen.name === "mission");
      return { ...state, ride, nextStopAt, ...(stale ? { screen: IDLE, match: null, stampedAt: null } : {}) };
    }
    case "match.found":
      return { ...state, match: event, screen: { name: "match", match: event, arrived: false }, stampedAt: null };
    case "match.cleared":
      if (state.match && state.match.matchId !== event.matchId) return state;
      return { ...state, match: null, stampedAt: null, screen: state.screen.name === "stamp" ? state.screen : IDLE };
    case "mission.start":
      setServerNow(event.serverNow, at);
      return {
        ...state,
        stampedAt: null,
        screen: { name: "mission", mission: event.mission, partner: state.match?.partner ?? null, tapped: 0 },
      };
    case "mission.end":
      if (event.reason === "stamped") {
        // stamp.awarded should follow; App falls back to Idle after 5 s if it does not.
        return { ...state, stampedAt: at };
      }
      return state.screen.name === "mission" ? { ...state, screen: IDLE, stampedAt: null } : state;
    case "stamp.awarded":
      return { ...state, stampedAt: null, screen: { name: "stamp", stamp: event.stamp } };
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "linked":
      return { ...state, token: action.token, status: "connecting", screen: IDLE, stampedAt: null, sendError: null };
    case "unlinked":
      return { ...initState(), token: null };
    case "status":
      return { ...state, status: action.status };
    case "event":
      return onEvent(state, action.event, action.at);
    case "arrived":
      return state.screen.name === "match" ? { ...state, screen: { ...state.screen, arrived: true } } : state;
    case "notNow":
      return { ...state, match: null, screen: IDLE, stampedAt: null };
    case "stampDismissed":
      return state.screen.name === "stamp" ? { ...state, screen: IDLE } : state;
    case "stampTimeout":
      return state.stampedAt !== null && state.screen.name === "mission"
        ? { ...state, screen: IDLE, stampedAt: null }
        : { ...state, stampedAt: null };
    case "sendError":
      return { ...state, sendError: action.message };
  }
}

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const socketRef = useRef<RiderSocket | null>(null);
  useWakeLock(Boolean(state.token));

  useEffect(() => {
    if (!state.token) return;
    const socket = connectRiderSocket({
      token: state.token,
      onEvent: (event) => dispatch({ type: "event", event, at: Date.now() }),
      onStatus: (status) => dispatch({ type: "status", status }),
      onAuthFailed: () => {
        clearToken();
        dispatch({ type: "unlinked" });
      },
    });
    socketRef.current = socket;
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [state.token]);

  // mission.end "stamped" with no stamp.awarded within 5 s -> Idle.
  useEffect(() => {
    if (state.stampedAt === null) return;
    const id = window.setTimeout(() => dispatch({ type: "stampTimeout" }), 5_000);
    return () => window.clearTimeout(id);
  }, [state.stampedAt]);

  useEffect(() => {
    if (!state.sendError) return;
    const id = window.setTimeout(() => dispatch({ type: "sendError", message: null }), 3_000);
    return () => window.clearTimeout(id);
  }, [state.sendError]);

  const onLinked = useCallback((token: string) => dispatch({ type: "linked", token }), []);
  const onArrived = useCallback(() => {
    void (async () => {
      const ok = await socketRef.current?.send({ type: "rider.arrived" });
      if (ok === false) dispatch({ type: "sendError", message: "Couldn't send" });
      else dispatch({ type: "arrived" });
    })();
  }, []);
  const onNotNow = useCallback(() => {
    void (async () => {
      const ok = await socketRef.current?.send({ type: "rider.notNow" });
      if (ok === false) dispatch({ type: "sendError", message: "Couldn't send" });
      else dispatch({ type: "notNow" });
    })();
  }, []);
  const onStampDone = useCallback(() => dispatch({ type: "stampDismissed" }), []);
  const onRetry = useCallback(() => socketRef.current?.retryNow(), []);

  if (!state.token) return <LinkCode onLinked={onLinked} />;
  if (state.status === "offline") return <Offline onRetry={onRetry} />;

  const { screen } = state;
  const banner = state.sendError ? (
    <div className="hud-send-error" role="status" aria-live="assertive">
      {state.sendError}
    </div>
  ) : null;
  switch (screen.name) {
    case "idle":
      return (
        <>
          <Idle ride={state.ride} nextStopAt={state.nextStopAt} status={state.status} />
          {banner}
        </>
      );
    case "match":
      return (
        <>
          <MatchCard
            match={screen.match}
            currentCar={state.ride?.car}
            arrived={screen.arrived}
            onArrived={onArrived}
            onNotNow={onNotNow}
          />
          {banner}
        </>
      );
    case "mission":
      return (
        <>
          <Mission mission={screen.mission} partner={screen.partner} tapped={screen.tapped} />
          {banner}
        </>
      );
    case "stamp":
      return (
        <>
          <Stamp stamp={screen.stamp} onDone={onStampDone} />
          {banner}
        </>
      );
  }
}
