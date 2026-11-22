/**
 * Pure glasses HUD state machine (events from /ws/rider).
 * App.tsx wires sockets, wake lock and React; tests import reduceGlasses / onGlassesEvent.
 *
 * Side effects (setServerNow, localStorage) stay in App — call noteServerNow before dispatching.
 */
import type { Mission as MissionModel, Partner, RideState, ServerToRider, Stamp as StampModel } from "@questline/protocol";
import type { MatchFound, SocketStatus } from "./lib/socket";

export type GlassesScreen =
  | { name: "idle" }
  | { name: "match"; match: MatchFound; arrived: boolean }
  | { name: "mission"; mission: MissionModel; partner: Partner | null; tapped: 0 | 1 | 2 }
  | { name: "stamp"; stamp: StampModel };

export interface GlassesState {
  token: string | null;
  status: SocketStatus;
  screen: GlassesScreen;
  ride: RideState | null;
  /** Epoch ms of the next stop, computed when ride.state arrived. */
  nextStopAt: number | null;
  /** Current match, kept so Mission can show the partner. */
  match: MatchFound | null;
  /** When mission.end reason=stamped arrived; Idle if stamp.awarded never follows. */
  stampedAt: number | null;
  /** Stamp ids already shown (live stamp.awarded or snapshot recentStamp). */
  shownStampId: string | null;
  sendError: string | null;
}

export type GlassesAction =
  | { type: "linked"; token: string }
  | { type: "unlinked" }
  | { type: "status"; status: SocketStatus }
  | { type: "event"; event: ServerToRider; at: number }
  | { type: "arrived" }
  | { type: "notNow" }
  | { type: "stampDismissed" }
  | { type: "stampTimeout" }
  | { type: "sendError"; message: string | null };

export const GLASSES_IDLE: GlassesScreen = { name: "idle" };

export function initGlassesState(token: string | null = null): GlassesState {
  return {
    token,
    status: "connecting",
    screen: GLASSES_IDLE,
    ride: null,
    nextStopAt: null,
    match: null,
    stampedAt: null,
    shownStampId: null,
    sendError: null,
  };
}

/** Apply one ServerToRider event (pure). */
export function onGlassesEvent(state: GlassesState, event: ServerToRider, at: number): GlassesState {
  switch (event.type) {
    case "ride.snapshot": {
      // Sent after rider.hello and returned by the polling fallback: redraw from scratch.
      const { state: ride, match, mission, recentStamp } = event.snapshot;
      const nextStopAt = ride.nextStopEtaSec === null ? null : at + ride.nextStopEtaSec * 1000;
      let screen: GlassesScreen = GLASSES_IDLE;
      let shownStampId = state.shownStampId;
      if (mission) screen = { name: "mission", mission, partner: match?.partner ?? null, tapped: 0 };
      else if (match) screen = { name: "match", match: { type: "match.found", ...match }, arrived: false };
      // Missed stamp.awarded while hidden: catch up from recentStamp once per stamp id.
      if (recentStamp && recentStamp.id !== state.shownStampId) {
        screen = { name: "stamp", stamp: recentStamp };
        shownStampId = recentStamp.id;
      } else if (state.screen.name === "stamp") {
        screen = state.screen; // let the celebration finish
      }
      return {
        ...state,
        ride,
        nextStopAt,
        match: match ? { type: "match.found", ...match } : null,
        screen,
        stampedAt: null,
        shownStampId,
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
      const ride = event.state;
      const nextStopAt = ride.nextStopEtaSec === null ? null : at + ride.nextStopEtaSec * 1000;
      const stale =
        (ride.status === "off" || ride.status === "riding") &&
        (state.screen.name === "match" || state.screen.name === "mission");
      return { ...state, ride, nextStopAt, ...(stale ? { screen: GLASSES_IDLE, match: null, stampedAt: null } : {}) };
    }
    case "match.found":
      return { ...state, match: event, screen: { name: "match", match: event, arrived: false }, stampedAt: null };
    case "match.cleared":
      if (state.match && state.match.matchId !== event.matchId) return state;
      return {
        ...state,
        match: null,
        stampedAt: null,
        screen: state.screen.name === "stamp" ? state.screen : GLASSES_IDLE,
      };
    case "mission.start":
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
      return state.screen.name === "mission" ? { ...state, screen: GLASSES_IDLE, stampedAt: null } : state;
    case "stamp.awarded":
      return {
        ...state,
        stampedAt: null,
        shownStampId: event.stamp.id,
        screen: { name: "stamp", stamp: event.stamp },
      };
  }
}

export function reduceGlasses(state: GlassesState, action: GlassesAction): GlassesState {
  switch (action.type) {
    case "linked":
      return { ...state, token: action.token, status: "connecting", screen: GLASSES_IDLE, stampedAt: null, sendError: null };
    case "unlinked":
      return initGlassesState(null);
    case "status":
      return { ...state, status: action.status };
    case "event":
      return onGlassesEvent(state, action.event, action.at);
    case "arrived":
      return state.screen.name === "match" ? { ...state, screen: { ...state.screen, arrived: true } } : state;
    case "notNow":
      return { ...state, match: null, screen: GLASSES_IDLE, stampedAt: null };
    case "stampDismissed":
      return state.screen.name === "stamp" ? { ...state, screen: GLASSES_IDLE } : state;
    case "stampTimeout":
      return state.stampedAt !== null && state.screen.name === "mission"
        ? { ...state, screen: GLASSES_IDLE, stampedAt: null }
        : { ...state, stampedAt: null };
    case "sendError":
      return { ...state, sendError: action.message };
  }
}

/** Clock offset for countdowns: serverNow - clientNow. */
export function clockOffsetMs(serverNow: number, clientNow: number): number {
  return serverNow - clientNow;
}
