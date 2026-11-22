/**
 * games/types.ts: the two-player games played between a pair of glasses and a phone
 * (glasses-web at /g/, phone-web at /m).
 *
 * A room holds two seats. Seat "a" opened the room (the glasses, which show the code) and
 * seat "b" typed the code in (the phone). The worker's GameRoom Durable Object owns the
 * state and runs one GameModule at a time; clients poll for their own view of it and post
 * actions. A module is pure: state in, state out, with the clock and the dice passed in.
 */

export type Seat = "a" | "b";
/** Who sent an action. "server" is the worker feeding back the result of async work. */
export type Actor = Seat | "server";

export function otherSeat(seat: Seat): Seat {
  return seat === "a" ? "b" : "a";
}

export const GAME_IDS = ["tale", "impressions", "trivia"] as const;
export type GameId = (typeof GAME_IDS)[number];

export interface GameCtx {
  /** Server time, epoch ms. Deadlines in state and views are in this clock. */
  now: number;
  /** Uniform in [0, 1). Use this, not Math.random, so tests can fix the dice. */
  rand: () => number;
}

export interface GameModule<S, V> {
  id: GameId;
  title: string;
  /** `seed` is whatever the worker's prepare hook for this game returned, or undefined. */
  init(ctx: GameCtx, seed: unknown): S;
  /** Apply one action. Return the same object when the action is not valid right now. */
  reduce(state: S, from: Actor, action: unknown, ctx: GameCtx): S;
  /** Move on from any phase whose deadline has passed. Called on every poll. Same object if nothing changed. */
  tick(state: S, ctx: GameCtx): S;
  /** What one seat may see. Leave out the other seat's secrets. */
  view(state: S, seat: Seat): V;
  /** True on the last screen, when the shell's "Next game" and "Again" apply. */
  isDone(state: S): boolean;
}

/** One seat in one room. */
export interface SeatRef {
  code: string;
  seat: Seat;
}

/** What a client gets back from every room call. */
export interface RoomView {
  code: string;
  seat: Seat;
  /** The other seat has polled in the last few seconds. */
  partnerHere: boolean;
  /** null until both seats have joined for the first time. */
  gameId: GameId | null;
  /** The current module's view for this seat. Cast it to that game's view type. */
  game: unknown;
  done: boolean;
  /** Goes up each time a game starts (first game, "Next game", "Again"). Screens are keyed on it. */
  run: number;
  /** Server time when this view was made, to line the client clock up with deadlines. */
  now: number;
  /**
   * Set when this seat's player moved the game from their phone onto a pair of glasses: the
   * code those glasses were showing. The phone then only keeps the player company.
   */
  lens: string | null;
  /**
   * Set on the room a pair of glasses opened for itself, once a phone has moved a seat onto
   * them: the seat the glasses now play. They follow it instead of waiting in this room.
   */
  moved: SeatRef | null;
}

/** Actions the room handles itself. Everything else goes to the current game. */
export type RoomAction = { type: "room.next" } | { type: "room.again" };

/** Props every game screen takes, on the glasses and on the phone. */
export interface GameProps<V> {
  view: V;
  seat: Seat;
  send: (action: unknown) => void;
  /** Current server time, epoch ms. Compare deadlines against this, not Date.now(). */
  serverNow: () => number;
  /** Last screen only: move both players to the next game, or replay this one. */
  onNext: () => void;
  onAgain: () => void;
}
