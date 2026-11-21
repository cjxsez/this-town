/**
 * App.tsx (kiosk-web): the kiosk screen state machine.
 *
 * No router: the car comes from /kiosk/:car (lib/config.ts). Screens switch on
 * ServerToKiosk events from /ws/kiosk/:car?key=&role=screen (lib/socket.ts):
 *
 *   bad URL (no car or key)         -> Disconnected (config error)
 *   socket "offline"                -> Disconnected (reconnecting), over any screen
 *   kiosk.idle                      -> updates stats; Idle if no pair is active here
 *   pair.incoming                   -> PairIncoming (remember names + color by matchId)
 *   mission.show                    -> Mission (names from the stored pair)
 *   celebrate                       -> Celebrate, back to Idle after CELEBRATE_MS
 *   pair.cleared (active matchId)   -> Idle
 *   nfc.write                       -> ignored (Pi only, dropped in lib/socket.ts)
 *
 * Privacy: this screen is public. Only first names and colors ever reach state here;
 * ServerToKiosk does not carry interests or the why line, keep it that way.
 *
 * TODO:
 * - Two pairs meeting at the same kiosk at once: today the newest event wins the screen.
 *   Decide on split screen or a queue once the worker can produce that case.
 * - Confirm with the worker whether kiosk.idle is a periodic stats push or a "reset to
 *   idle" command. Treated as stats while a pair is active.
 */
import { useEffect, useReducer, useState } from "react";
import type { Mission as MissionModel, PairColor } from "@questline/protocol";
import { readConfig, type ConfigResult } from "./lib/config";
import { connectKioskSocket, type KioskSocketStatus, type ScreenEvent } from "./lib/socket";
import { Celebrate } from "./screens/Celebrate";
import { Disconnected } from "./screens/Disconnected";
import { Idle, type IdleStats } from "./screens/Idle";
import { Mission } from "./screens/Mission";
import { PairIncoming } from "./screens/PairIncoming";

const CELEBRATE_MS = 6000;

interface PairInfo {
  color: PairColor;
  firstNames: [string, string];
}

type Screen =
  | { name: "idle" }
  | { name: "pair"; matchId: string }
  | { name: "mission"; matchId: string; color: PairColor; mission: MissionModel }
  | { name: "celebrate"; matchId: string; color: PairColor; rare: boolean };

interface State {
  status: KioskSocketStatus;
  screen: Screen;
  stats: IdleStats | null;
  nextStopAt: number | null;
  /** Pairs seen via pair.incoming, by matchId, so later events can show first names. */
  pairs: Record<string, PairInfo>;
}

type Action =
  | { type: "status"; status: KioskSocketStatus }
  | { type: "event"; event: ScreenEvent; at: number }
  | { type: "celebrateDone"; matchId: string };

const IDLE: Screen = { name: "idle" };

const initialState: State = { status: "connecting", screen: IDLE, stats: null, nextStopAt: null, pairs: {} };

function activeMatchId(screen: Screen): string | null {
  return screen.name === "idle" ? null : screen.matchId;
}

function withoutPair(pairs: Record<string, PairInfo>, matchId: string): Record<string, PairInfo> {
  const next = { ...pairs };
  delete next[matchId];
  return next;
}

function onEvent(state: State, event: ScreenEvent, at: number): State {
  switch (event.type) {
    case "kiosk.idle": {
      const { type: _type, serverNow: _serverNow, ...stats } = event; // TODO: clock offset from serverNow
      const nextStopAt = stats.nextStopEtaSec === null ? null : at + stats.nextStopEtaSec * 1000;
      return { ...state, stats, nextStopAt };
    }
    case "pair.incoming":
      return {
        ...state,
        pairs: { ...state.pairs, [event.matchId]: { color: event.color, firstNames: event.firstNames } },
        screen: { name: "pair", matchId: event.matchId },
      };
    case "mission.show":
      return {
        ...state,
        screen: { name: "mission", matchId: event.matchId, color: event.color, mission: event.mission },
      };
    case "celebrate":
      return {
        ...state,
        screen: { name: "celebrate", matchId: event.matchId, color: event.color, rare: event.rare },
      };
    case "stamp.progress":
      // TODO: show "1 of 2 tapped" on the mission screen.
      return state;
    case "pair.cleared": {
      // Let a running celebration finish (with names); celebrateDone drops the pair.
      if (state.screen.name === "celebrate" && state.screen.matchId === event.matchId) return state;
      const pairs = withoutPair(state.pairs, event.matchId);
      const screen = activeMatchId(state.screen) === event.matchId ? IDLE : state.screen;
      return { ...state, pairs, screen };
    }
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "status":
      return { ...state, status: action.status };
    case "event":
      return onEvent(state, action.event, action.at);
    case "celebrateDone":
      if (state.screen.name !== "celebrate" || state.screen.matchId !== action.matchId) return state;
      return { ...state, screen: IDLE, pairs: withoutPair(state.pairs, action.matchId) };
  }
}

export function App() {
  const [config] = useState<ConfigResult>(() => readConfig());
  if (!config.ok) return <Disconnected car={config.car} error={config.error} />;
  return <KioskScreen car={config.config.car} kioskKey={config.config.key} />;
}

function KioskScreen({ car, kioskKey }: { car: string; kioskKey: string }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const socket = connectKioskSocket({
      config: { car, key: kioskKey },
      onEvent: (event) => dispatch({ type: "event", event, at: Date.now() }),
      onStatus: (status) => dispatch({ type: "status", status }),
    });
    return () => socket.close();
  }, [car, kioskKey]);

  const { screen } = state;

  useEffect(() => {
    if (screen.name !== "celebrate") return;
    const matchId = screen.matchId;
    const id = window.setTimeout(() => dispatch({ type: "celebrateDone", matchId }), CELEBRATE_MS);
    return () => window.clearTimeout(id);
  }, [screen]);

  if (state.status === "offline") return <Disconnected car={car} />;

  switch (screen.name) {
    case "idle":
      return <Idle car={car} stats={state.stats} nextStopAt={state.nextStopAt} />;
    case "pair": {
      const pair = state.pairs[screen.matchId];
      if (!pair) return <Idle car={car} stats={state.stats} nextStopAt={state.nextStopAt} />;
      return <PairIncoming color={pair.color} firstNames={pair.firstNames} />;
    }
    case "mission":
      return (
        <Mission
          color={screen.color}
          mission={screen.mission}
          firstNames={state.pairs[screen.matchId]?.firstNames ?? null}
        />
      );
    case "celebrate":
      return (
        <Celebrate
          color={screen.color}
          rare={screen.rare}
          firstNames={state.pairs[screen.matchId]?.firstNames ?? null}
        />
      );
  }
}
