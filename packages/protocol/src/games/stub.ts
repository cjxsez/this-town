/**
 * games/stub.ts: a placeholder game (both tap ready, then it is over). It stands in for a
 * game that is not written yet so the room and the playlist can be run end to end.
 */
import type { Actor, GameId, GameModule, Seat } from "./types";

export interface StubState {
  phase: "intro" | "done";
  ready: Record<Seat, boolean>;
}

export interface StubView {
  phase: "intro" | "done";
  youReady: boolean;
  theyReady: boolean;
}

export function stubGame(id: GameId, title: string): GameModule<StubState, StubView> {
  return {
    id,
    title,
    init: () => ({ phase: "intro", ready: { a: false, b: false } }),
    reduce(state, from: Actor, action) {
      if (from === "server" || state.phase !== "intro") return state;
      if ((action as { type?: string } | null)?.type !== "ready") return state;
      const ready = { ...state.ready, [from]: true };
      return { phase: ready.a && ready.b ? "done" : "intro", ready };
    },
    tick: (state) => state,
    view: (state, seat) => ({
      phase: state.phase,
      youReady: state.ready[seat],
      theyReady: state.ready[seat === "a" ? "b" : "a"],
    }),
    isDone: (state) => state.phase === "done",
  };
}
