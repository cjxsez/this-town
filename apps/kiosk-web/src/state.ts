/**
 * Pure kiosk screen state machine (events from /ws/kiosk/:car).
 * App.tsx wires sockets and React; tests import reduceKiosk / onKioskEvent here.
 *
 * Side effects (setServerNow) stay in App — call noteServerNow before dispatching.
 */
import type { Mission as MissionModel, PairColor } from "@questline/protocol";
import type { IdleStats } from "./screens/Idle";
import type { KioskSocketStatus, ScreenEvent } from "./lib/socket";

export interface PairInfo {
  color: PairColor;
  firstNames: [string, string];
  arrived: number;
}

export type KioskScreen =
  | { name: "idle" }
  | { name: "pair"; matchId: string }
  | { name: "mission"; matchId: string; color: PairColor; mission: MissionModel; startedAt: number; tapped: number }
  | { name: "celebrate"; matchId: string; color: PairColor; rare: boolean };

export interface KioskState {
  status: KioskSocketStatus;
  screen: KioskScreen;
  stats: IdleStats | null;
  nextStopAt: number | null;
  /** Pairs seen via pair.incoming, by matchId, so later events can show first names. */
  pairs: Record<string, PairInfo>;
}

export type KioskAction =
  | { type: "status"; status: KioskSocketStatus }
  | { type: "event"; event: ScreenEvent; at: number }
  | { type: "celebrateDone"; matchId: string };

export const KIOSK_IDLE: KioskScreen = { name: "idle" };

export const initialKioskState: KioskState = {
  status: "connecting",
  screen: KIOSK_IDLE,
  stats: null,
  nextStopAt: null,
  pairs: {},
};

function activeMatchId(screen: KioskScreen): string | null {
  return screen.name === "idle" ? null : screen.matchId;
}

function withoutPair(pairs: Record<string, PairInfo>, matchId: string): Record<string, PairInfo> {
  const next = { ...pairs };
  delete next[matchId];
  return next;
}

/** Apply one ServerToKiosk screen event (pure). */
export function onKioskEvent(state: KioskState, event: ScreenEvent, at: number): KioskState {
  switch (event.type) {
    case "kiosk.idle": {
      // Stats push only — do not reset an active pair screen.
      const { type: _type, serverNow: _serverNow, ...stats } = event;
      const nextStopAt = stats.nextStopEtaSec === null ? null : at + stats.nextStopEtaSec * 1000;
      return { ...state, stats, nextStopAt };
    }
    case "pair.incoming":
      // Newest pair wins the screen (worker allows one pair per kiosk; no split view).
      return {
        ...state,
        pairs: {
          ...state.pairs,
          [event.matchId]: { color: event.color, firstNames: event.firstNames, arrived: event.arrived },
        },
        screen: { name: "pair", matchId: event.matchId },
      };
    case "mission.show": {
      // A repeat mission.show (e.g. after a reconnect) keeps the bar's start and the taps.
      const same =
        state.screen.name === "mission" && state.screen.mission.sessionId === event.mission.sessionId
          ? state.screen
          : null;
      return {
        ...state,
        screen: {
          name: "mission",
          matchId: event.matchId,
          color: event.color,
          mission: event.mission,
          startedAt: same?.startedAt ?? at,
          tapped: same?.tapped ?? 0,
        },
      };
    }
    case "celebrate":
      return {
        ...state,
        screen: { name: "celebrate", matchId: event.matchId, color: event.color, rare: event.rare },
      };
    case "stamp.progress":
      if (state.screen.name !== "mission" || state.screen.matchId !== event.matchId) return state;
      return { ...state, screen: { ...state.screen, tapped: event.tapped } };
    case "pair.cleared": {
      // Let a running celebration finish (with names); celebrateDone drops the pair.
      // Stale clears for an old matchId must not blank a newer pair on screen.
      if (state.screen.name === "celebrate" && state.screen.matchId === event.matchId) return state;
      const pairs = withoutPair(state.pairs, event.matchId);
      const screen = activeMatchId(state.screen) === event.matchId ? KIOSK_IDLE : state.screen;
      return { ...state, pairs, screen };
    }
  }
}

export function reduceKiosk(state: KioskState, action: KioskAction): KioskState {
  switch (action.type) {
    case "status":
      return { ...state, status: action.status };
    case "event":
      return onKioskEvent(state, action.event, action.at);
    case "celebrateDone":
      if (state.screen.name !== "celebrate" || state.screen.matchId !== action.matchId) return state;
      return { ...state, screen: KIOSK_IDLE, pairs: withoutPair(state.pairs, action.matchId) };
  }
}

/** Clock offset for countdowns: serverNow - clientNow. */
export function clockOffsetMs(serverNow: number, clientNow: number): number {
  return serverNow - clientNow;
}
