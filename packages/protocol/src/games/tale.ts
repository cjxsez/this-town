/**
 * games/tale.ts: "Tall tale". Each player tells the story of their worst ride on the T, out
 * loud. Each was secretly dealt "tell the truth" or "make it up" (a coin flip per seat, so
 * both, one or neither may be lying), and each then calls the other's story true or made up.
 *
 *   intro    both tap ready (no timer)
 *   think    each seat sees only its own card and a story spark; THINK_MS, or both ready
 *   tell     one at a time, in a random order; TELL_MS each, or the teller says done
 *   verdict  both call their partner's story at once; VERDICT_MS; no call scores nothing
 *   reveal   the cards, the calls and the points. The last screen.
 *
 * Scoring per story: the listener gets a point for a right call, the teller gets a point
 * when the listener called it wrong. With no call nobody scores on that story.
 */
import { TALE_FAKE_SPARKS, TALE_TRUE_SPARKS } from "./tale-deck";
import { otherSeat, type Actor, type GameCtx, type GameModule, type Seat } from "./types";

// Demo pacing: the three games' timed phases add up to 2.5 minutes (tale 50 s, impressions 40 s, trivia 60 s).
export const TALE_THINK_MS = 7_000;
export const TALE_TELL_MS = 18_000;
export const TALE_VERDICT_MS = 7_000;
/**
 * A press this soon after a screen appears is taken as a leftover tap from the screen before
 * (a double tap on "I'm ready" would otherwise land on "Done"). The views carry `opensAt` so
 * the screens show the button as not ready yet instead of eating the tap without a word.
 */
export const TALE_TELL_GUARD_MS = 3000;
export const TALE_CALL_GUARD_MS = 1000;

export type TaleCard = "truth" | "fake";
export type TalePhase = "intro" | "think" | "tell" | "verdict" | "reveal";

export interface TaleState {
  phase: TalePhase;
  /** Ready taps for the intro, then again for the think phase. */
  ready: Record<Seat, boolean>;
  cards: Record<Seat, TaleCard>;
  sparks: Record<Seat, string>;
  /** Who tells first, then second. */
  order: [Seat, Seat];
  /** Index into `order` during the tell phase. */
  turn: 0 | 1;
  /** Each seat's call about the other seat's story. */
  calls: Record<Seat, TaleCard | null>;
  /** When the current phase (or turn) began, server ms. */
  since: number;
  /** When the current phase (or turn) ends by itself, server ms. null when it has no timer. */
  deadline: number | null;
}

/** One story on the reveal screen. */
export interface TaleResult {
  card: TaleCard;
  /** What the listener called it. null: no call in time. */
  call: TaleCard | null;
  /** How it went, from the viewer's side, e.g. "You fooled them". */
  note: string;
  /** The viewer scored a point on this story. */
  point: boolean;
}

export type TaleView =
  | { phase: "intro"; youReady: boolean; theyReady: boolean }
  | { phase: "think"; deadline: number; card: TaleCard; spark: string; youReady: boolean; theyReady: boolean }
  | {
      phase: "tell";
      deadline: number;
      /** 0 for the first story, 1 for the second. Sent back with "done". */
      turn: 0 | 1;
      telling: boolean;
      /** Server ms from which "done" is taken (TALE_TELL_GUARD_MS into the turn). */
      opensAt: number;
      /** Your own card and spark, only while you are the one telling. */
      card: TaleCard | null;
      spark: string | null;
    }
  | {
      phase: "verdict";
      deadline: number;
      /** Server ms from which a call is taken (TALE_CALL_GUARD_MS into the verdict). */
      opensAt: number;
      yourCall: TaleCard | null;
      theyCalled: boolean;
    }
  | {
      phase: "reveal";
      /** Your story and your partner's call on it. */
      yours: TaleResult;
      /** Your partner's story and your call on it. */
      theirs: TaleResult;
      youPoints: number;
      theyPoints: number;
      summary: string;
    };

export type TaleAction =
  | { type: "ready"; phase: "intro" | "think" }
  | { type: "done"; turn: 0 | 1 }
  | { type: "call"; call: TaleCard };

function pick<T>(list: readonly T[], ctx: GameCtx): T {
  return list[Math.min(list.length - 1, Math.floor(ctx.rand() * list.length))]!;
}

function deal(ctx: GameCtx): { card: TaleCard; spark: string } {
  const card: TaleCard = ctx.rand() < 0.5 ? "truth" : "fake";
  return { card, spark: pick(card === "fake" ? TALE_FAKE_SPARKS : TALE_TRUE_SPARKS, ctx) };
}

function startTell(state: TaleState, turn: 0 | 1, ctx: GameCtx): TaleState {
  return { ...state, phase: "tell", turn, since: ctx.now, deadline: ctx.now + TALE_TELL_MS };
}

function startVerdict(state: TaleState, ctx: GameCtx): TaleState {
  return { ...state, phase: "verdict", since: ctx.now, deadline: ctx.now + TALE_VERDICT_MS };
}

/** Move on from the current timed phase, whether by a tap or by the clock. */
function advance(state: TaleState, ctx: GameCtx): TaleState {
  switch (state.phase) {
    case "think":
      return startTell(state, 0, ctx);
    case "tell":
      return state.turn === 0 ? startTell(state, 1, ctx) : startVerdict(state, ctx);
    case "verdict":
      return { ...state, phase: "reveal", since: ctx.now, deadline: null };
    default:
      return state;
  }
}

/** Points for `seat`: a right call on the partner's story, plus fooling the partner on their own. */
export function talePoints(state: Pick<TaleState, "cards" | "calls">, seat: Seat): number {
  const other = otherSeat(seat);
  const rightCall = state.calls[seat] !== null && state.calls[seat] === state.cards[other];
  const fooled = state.calls[other] !== null && state.calls[other] !== state.cards[seat];
  return (rightCall ? 1 : 0) + (fooled ? 1 : 0);
}

/** The one-liner under the reveal. The same for both seats. */
export function taleSummary(state: Pick<TaleState, "cards" | "calls">): string {
  const { cards, calls } = state;
  if (calls.a === null && calls.b === null) return "Nobody made a call. The mystery lives on.";
  const right = (calls.a === cards.b ? 1 : 0) + (calls.b === cards.a ? 1 : 0);
  const fakes = (cards.a === "fake" ? 1 : 0) + (cards.b === "fake" ? 1 : 0);
  if (fakes === 2) {
    return ["Two liars, and both got away with it.", "Two liars. Only one got caught.", "Two liars, two detectives."][right]!;
  }
  if (fakes === 0) {
    return [
      "All true, and nobody believed a word.",
      "All true, and one of you still got doubted.",
      "All true. The T really is like that.",
    ][right]!;
  }
  return [
    "One true, one tall tale. You both got it backwards.",
    "One true, one tall tale. Only one of you could tell.",
    "One true, one tall tale. Both spotted.",
  ][right]!;
}

/** Your own story: did your partner see through it? */
function yourResult(card: TaleCard, call: TaleCard | null): TaleResult {
  if (call === null) return { card, call, note: "Your partner made no call", point: false };
  if (call !== card) return { card, call, note: card === "fake" ? "You fooled them" : "They doubted you", point: true };
  return { card, call, note: card === "fake" ? "They caught you" : "They believed you", point: false };
}

/** Your partner's story: did you call it right? */
function theirResult(card: TaleCard, call: TaleCard | null): TaleResult {
  if (call === null) return { card, call, note: "You made no call", point: false };
  if (call === card) return { card, call, note: "You called it", point: true };
  return { card, call, note: card === "fake" ? "They fooled you" : "It was all true", point: false };
}

function isSeat(from: Actor): from is Seat {
  return from === "a" || from === "b";
}

export const taleGame: GameModule<TaleState, TaleView> = {
  id: "tale",
  title: "Tall tale",

  init(ctx) {
    const a = deal(ctx);
    const b = deal(ctx);
    return {
      phase: "intro",
      ready: { a: false, b: false },
      cards: { a: a.card, b: b.card },
      sparks: { a: a.spark, b: b.spark },
      order: ctx.rand() < 0.5 ? ["a", "b"] : ["b", "a"],
      turn: 0,
      calls: { a: null, b: null },
      since: ctx.now,
      deadline: null,
    };
  },

  reduce(state, from, action, ctx) {
    if (!isSeat(from) || typeof action !== "object" || action === null) return state;
    const act = action as { type?: unknown; phase?: unknown; turn?: unknown; call?: unknown };

    if (act.type === "ready") {
      if ((state.phase !== "intro" && state.phase !== "think") || act.phase !== state.phase || state.ready[from]) return state;
      const ready = { ...state.ready, [from]: true };
      if (!(ready.a && ready.b)) return { ...state, ready };
      if (state.phase === "intro") {
        return { ...state, phase: "think", ready: { a: false, b: false }, since: ctx.now, deadline: ctx.now + TALE_THINK_MS };
      }
      return advance({ ...state, ready }, ctx);
    }

    if (act.type === "done") {
      if (state.phase !== "tell" || act.turn !== state.turn || state.order[state.turn] !== from) return state;
      if (ctx.now - state.since < TALE_TELL_GUARD_MS) return state;
      return advance(state, ctx);
    }

    if (act.type === "call") {
      if (state.phase !== "verdict" || state.calls[from] !== null) return state;
      if (act.call !== "truth" && act.call !== "fake") return state;
      if (ctx.now - state.since < TALE_CALL_GUARD_MS) return state;
      const calls = { ...state.calls, [from]: act.call };
      const next = { ...state, calls };
      return calls.a !== null && calls.b !== null ? advance(next, ctx) : next;
    }

    return state;
  },

  tick(state, ctx) {
    if (state.deadline === null || ctx.now < state.deadline) return state;
    return advance(state, ctx);
  },

  view(state, seat) {
    const other = otherSeat(seat);
    switch (state.phase) {
      case "intro":
        return { phase: "intro", youReady: state.ready[seat], theyReady: state.ready[other] };
      case "think":
        return {
          phase: "think",
          deadline: state.deadline ?? state.since,
          card: state.cards[seat],
          spark: state.sparks[seat],
          youReady: state.ready[seat],
          theyReady: state.ready[other],
        };
      case "tell": {
        const telling = state.order[state.turn] === seat;
        return {
          phase: "tell",
          deadline: state.deadline ?? state.since,
          turn: state.turn,
          telling,
          opensAt: state.since + TALE_TELL_GUARD_MS,
          card: telling ? state.cards[seat] : null,
          spark: telling ? state.sparks[seat] : null,
        };
      }
      case "verdict":
        return {
          phase: "verdict",
          deadline: state.deadline ?? state.since,
          opensAt: state.since + TALE_CALL_GUARD_MS,
          yourCall: state.calls[seat],
          theyCalled: state.calls[other] !== null,
        };
      case "reveal":
        return {
          phase: "reveal",
          yours: yourResult(state.cards[seat], state.calls[other]),
          theirs: theirResult(state.cards[other], state.calls[seat]),
          youPoints: talePoints(state, seat),
          theyPoints: talePoints(state, other),
          summary: taleSummary(state),
        };
    }
  },

  isDone: (state) => state.phase === "reveal",
};
