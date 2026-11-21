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
 *
 * TODO:
 * - Reloading mid-match loses the card: RideState says "matched"/"in-mission" but carries
 *   no match or mission. Ask the worker to replay match.found / mission.start after
 *   rider.hello, or extend the protocol.
 * - mission.end "stamped" with no stamp.awarded within ~5 s: fall back to Idle.
 * - Screen Wake Lock (navigator.wakeLock) if the glasses browser supports it; the page
 *   must stay open for the whole ride (no notifications on the platform).
 */
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { Mission as MissionModel, Partner, RideState, ServerToRider, Stamp as StampModel } from "@questline/protocol";
import { clearToken, loadToken } from "./lib/link";
import { connectRiderSocket, type MatchFound, type RiderSocket, type SocketStatus } from "./lib/socket";
import { Idle } from "./screens/Idle";
import { LinkCode } from "./screens/LinkCode";
import { MatchCard } from "./screens/MatchCard";
import { Mission } from "./screens/Mission";
import { Offline } from "./screens/Offline";
import { Stamp } from "./screens/Stamp";

type Screen =
  | { name: "idle" }
  | { name: "match"; match: MatchFound; arrived: boolean }
  | { name: "mission"; mission: MissionModel; partner: Partner | null }
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
}

type Action =
  | { type: "linked"; token: string }
  | { type: "unlinked" }
  | { type: "status"; status: SocketStatus }
  | { type: "event"; event: ServerToRider; at: number }
  | { type: "arrived" }
  | { type: "notNow" }
  | { type: "stampDismissed" };

const IDLE: Screen = { name: "idle" };

function initState(): State {
  return { token: loadToken(), status: "connecting", screen: IDLE, ride: null, nextStopAt: null, match: null };
}

function onEvent(state: State, event: ServerToRider, at: number): State {
  switch (event.type) {
    case "ride.state": {
      const ride = event.state;
      const nextStopAt = ride.nextStopEtaSec === null ? null : at + ride.nextStopEtaSec * 1000;
      const stale =
        (ride.status === "off" || ride.status === "riding") &&
        (state.screen.name === "match" || state.screen.name === "mission");
      return { ...state, ride, nextStopAt, ...(stale ? { screen: IDLE, match: null } : {}) };
    }
    case "match.found":
      return { ...state, match: event, screen: { name: "match", match: event, arrived: false } };
    case "match.cleared":
      if (state.match && state.match.matchId !== event.matchId) return state;
      return { ...state, match: null, screen: state.screen.name === "stamp" ? state.screen : IDLE };
    case "mission.start":
      return { ...state, screen: { name: "mission", mission: event.mission, partner: state.match?.partner ?? null } };
    case "mission.end":
      if (event.reason === "stamped") return state; // stamp.awarded is on its way
      return state.screen.name === "mission" ? { ...state, screen: IDLE } : state;
    case "stamp.awarded":
      return { ...state, screen: { name: "stamp", stamp: event.stamp } };
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "linked":
      return { ...state, token: action.token, status: "connecting", screen: IDLE };
    case "unlinked":
      return { ...initState(), token: null };
    case "status":
      return { ...state, status: action.status };
    case "event":
      return onEvent(state, action.event, action.at);
    case "arrived":
      return state.screen.name === "match" ? { ...state, screen: { ...state.screen, arrived: true } } : state;
    case "notNow":
      return { ...state, match: null, screen: IDLE };
    case "stampDismissed":
      return state.screen.name === "stamp" ? { ...state, screen: IDLE } : state;
  }
}

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const socketRef = useRef<RiderSocket | null>(null);

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

  const onLinked = useCallback((token: string) => dispatch({ type: "linked", token }), []);
  const onArrived = useCallback(() => {
    socketRef.current?.send({ type: "rider.arrived" });
    dispatch({ type: "arrived" });
  }, []);
  const onNotNow = useCallback(() => {
    // TODO: if send() returns false (offline/polling), queue it or show "Couldn't send".
    socketRef.current?.send({ type: "rider.notNow" });
    dispatch({ type: "notNow" });
  }, []);
  const onStampDone = useCallback(() => dispatch({ type: "stampDismissed" }), []);
  const onRetry = useCallback(() => socketRef.current?.retryNow(), []);

  if (!state.token) return <LinkCode onLinked={onLinked} />;
  if (state.status === "offline") return <Offline onRetry={onRetry} />;

  const { screen } = state;
  switch (screen.name) {
    case "idle":
      return <Idle ride={state.ride} nextStopAt={state.nextStopAt} status={state.status} />;
    case "match":
      return <MatchCard match={screen.match} arrived={screen.arrived} onArrived={onArrived} onNotNow={onNotNow} />;
    case "mission":
      return <Mission mission={screen.mission} partner={screen.partner} />;
    case "stamp":
      return <Stamp stamp={screen.stamp} onDone={onStampDone} />;
  }
}
