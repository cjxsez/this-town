/**
 * games/impressions.ts: "First impressions". Two strangers guess each other on a slider.
 *
 *   intro  both tap ready
 *   guess  one question about your partner; each player silently sets a slider and locks it
 *          in. Clients also send the slider position as it moves, so when the clock runs
 *          out the position it was left at is taken.
 *   talk   both guesses are shown to both, and the two of them talk. Each can say how close
 *          their partner's guess about them was (spot on / close / way off). Once both have,
 *          the round ends a few seconds later; otherwise it ends on the clock.
 *   done   after ROUNDS rounds: how each player's guesses were rated, and a verdict.
 *
 * A player's guess is kept out of the other player's view until both are locked in.
 */
import {
  IMPRESSIONS_DECK,
  impressionsSnap,
  impressionsStart,
  type ImpressionsQuestion,
} from "./impressions-deck";
import { otherSeat, type Actor, type GameCtx, type GameModule, type Seat } from "./types";

export * from "./impressions-deck";

export const IMPRESSIONS_ROUNDS = 5;
const MIN_BOSTON = 2;
const GUESS_MS = 12_000;
const TALK_MS = 20_000;
/** Once both players have rated, the compare screen stays this long. */
const RATED_MS = 4_000;

export type ImpressionsRating = "spot" | "close" | "off";
const RATINGS: readonly ImpressionsRating[] = ["spot", "close", "off"];

export type ImpressionsAction =
  | { type: "ready" }
  /** The slider moved (not locked yet). */
  | { type: "slide"; value: number }
  | { type: "lock"; value: number }
  /** How close your partner's guess about you was. Can be changed until the round ends. */
  | { type: "rate"; rating: ImpressionsRating };

interface Round {
  /** guess[seat] is that seat's guess about the other seat. */
  guess: Record<Seat, number>;
  /** rating[seat] is that seat's verdict on the other seat's guess. */
  rating: Record<Seat, ImpressionsRating | null>;
}

export interface ImpressionsState {
  phase: "intro" | "guess" | "talk" | "done";
  ready: Record<Seat, boolean>;
  questions: ImpressionsQuestion[];
  /** Index of the round being played. */
  round: number;
  deadline: number | null;
  /** Current slider positions in the guess phase. */
  draft: Record<Seat, number>;
  locked: Record<Seat, boolean>;
  /** Finished rounds, plus the current one while in the talk phase. */
  rounds: Round[];
}

export interface ImpressionsTally {
  spot: number;
  close: number;
  off: number;
}

export type ImpressionsVerdict = "well" | "surprises" | "mystery";

export type ImpressionsView =
  | { phase: "intro"; rounds: number; youReady: boolean; theyReady: boolean }
  | {
      phase: "guess";
      round: number;
      rounds: number;
      question: ImpressionsQuestion;
      deadline: number;
      /** Your slider position as the server last heard it. */
      yourValue: number;
      youLocked: boolean;
      theyLocked: boolean;
    }
  | {
      phase: "talk";
      round: number;
      rounds: number;
      question: ImpressionsQuestion;
      deadline: number;
      /** Your guess about your partner, and theirs about you. */
      yourGuess: number;
      theirGuess: number;
      /** What you said about their guess, and what they said about yours. */
      yourRating: ImpressionsRating | null;
      theirRating: ImpressionsRating | null;
    }
  | {
      phase: "done";
      rounds: number;
      /** How your partner rated your guesses, and how you rated theirs. */
      yours: ImpressionsTally;
      theirs: ImpressionsTally;
      verdict: ImpressionsVerdict;
      rows: {
        question: ImpressionsQuestion;
        yourGuess: number;
        theirGuess: number;
        /** Your partner's verdict on your guess. */
        rating: ImpressionsRating | null;
      }[];
    };

/** Draw `n` of `from` without repeats. */
function draw<T>(from: T[], n: number, rand: () => number): T[] {
  const pool = from.slice();
  const out: T[] = [];
  while (out.length < n && pool.length) {
    const i = Math.min(pool.length - 1, Math.floor(rand() * pool.length));
    out.push(pool.splice(i, 1)[0]!);
  }
  return out;
}

function pickQuestions(rand: () => number): ImpressionsQuestion[] {
  const boston = draw(IMPRESSIONS_DECK.filter((q) => q.boston), MIN_BOSTON, rand);
  const rest = draw(IMPRESSIONS_DECK.filter((q) => !boston.includes(q)), IMPRESSIONS_ROUNDS - boston.length, rand);
  return draw([...boston, ...rest], IMPRESSIONS_ROUNDS, rand);
}

function startRound(state: ImpressionsState, round: number, ctx: GameCtx): ImpressionsState {
  const start = impressionsStart(state.questions[round]!);
  return {
    ...state,
    phase: "guess",
    round,
    deadline: ctx.now + GUESS_MS,
    draft: { a: start, b: start },
    locked: { a: false, b: false },
  };
}

function startTalk(state: ImpressionsState, ctx: GameCtx): ImpressionsState {
  return {
    ...state,
    phase: "talk",
    deadline: ctx.now + TALK_MS,
    locked: { a: true, b: true },
    rounds: [...state.rounds.slice(0, state.round), { guess: { ...state.draft }, rating: { a: null, b: null } }],
  };
}

function endRound(state: ImpressionsState, ctx: GameCtx): ImpressionsState {
  if (state.round + 1 < state.questions.length) return startRound(state, state.round + 1, ctx);
  return { ...state, phase: "done", deadline: null };
}

/** How `seat`'s guesses were rated by the other seat. */
function tally(state: ImpressionsState, seat: Seat): ImpressionsTally {
  const out: ImpressionsTally = { spot: 0, close: 0, off: 0 };
  for (const round of state.rounds) {
    const rating = round.rating[otherSeat(seat)];
    if (rating) out[rating] += 1;
  }
  return out;
}

function verdict(a: ImpressionsTally, b: ImpressionsTally): ImpressionsVerdict {
  const rated = a.spot + a.close + a.off + b.spot + b.close + b.off;
  if (rated === 0) return "mystery";
  // Spot on counts double; "well" is at least a "close" on average.
  const points = 2 * (a.spot + b.spot) + a.close + b.close;
  return points >= rated ? "well" : "surprises";
}

export const impressionsGame: GameModule<ImpressionsState, ImpressionsView> = {
  id: "impressions",
  title: "First impressions",

  init: (ctx) => ({
    phase: "intro",
    ready: { a: false, b: false },
    questions: pickQuestions(ctx.rand),
    round: 0,
    deadline: null,
    draft: { a: 0, b: 0 },
    locked: { a: false, b: false },
    rounds: [],
  }),

  reduce(state, from: Actor, action, ctx) {
    if (from === "server" || typeof action !== "object" || action === null) return state;
    const act = action as { type?: unknown; value?: unknown; rating?: unknown };

    if (state.phase === "intro") {
      if (act.type !== "ready" || state.ready[from]) return state;
      const ready = { ...state.ready, [from]: true };
      return ready.a && ready.b ? startRound({ ...state, ready }, 0, ctx) : { ...state, ready };
    }

    if (state.phase === "guess") {
      if (act.type !== "slide" && act.type !== "lock") return state;
      if (state.locked[from] || typeof act.value !== "number" || !Number.isFinite(act.value)) return state;
      const value = impressionsSnap(state.questions[state.round]!, act.value);
      if (act.type === "slide") {
        return value === state.draft[from] ? state : { ...state, draft: { ...state.draft, [from]: value } };
      }
      const next = { ...state, draft: { ...state.draft, [from]: value }, locked: { ...state.locked, [from]: true } };
      return next.locked.a && next.locked.b ? startTalk(next, ctx) : next;
    }

    if (state.phase === "talk") {
      const rating = act.rating as ImpressionsRating;
      const round = state.rounds[state.round];
      if (act.type !== "rate" || !RATINGS.includes(rating) || !round || round.rating[from] === rating) return state;
      const ratings = { ...round.rating, [from]: rating };
      const rounds = [...state.rounds.slice(0, state.round), { ...round, rating: ratings }];
      const bothRated = ratings.a !== null && ratings.b !== null;
      // The first time both have rated, cut the clock short. A later change does not reset it.
      const firstTime = bothRated && round.rating[from] === null;
      const deadline = firstTime ? Math.min(state.deadline ?? Infinity, ctx.now + RATED_MS) : state.deadline;
      return { ...state, rounds, deadline };
    }

    return state;
  },

  tick(state, ctx) {
    if (state.deadline === null || ctx.now < state.deadline) return state;
    if (state.phase === "guess") return startTalk(state, ctx);
    if (state.phase === "talk") return endRound(state, ctx);
    return state;
  },

  view(state, seat) {
    const other = otherSeat(seat);
    const rounds = state.questions.length;
    if (state.phase === "intro") {
      return { phase: "intro", rounds, youReady: state.ready[seat], theyReady: state.ready[other] };
    }
    if (state.phase === "guess") {
      return {
        phase: "guess",
        round: state.round,
        rounds,
        question: state.questions[state.round]!,
        deadline: state.deadline ?? 0,
        yourValue: state.draft[seat],
        youLocked: state.locked[seat],
        theyLocked: state.locked[other],
      };
    }
    if (state.phase === "talk") {
      const round = state.rounds[state.round]!;
      return {
        phase: "talk",
        round: state.round,
        rounds,
        question: state.questions[state.round]!,
        deadline: state.deadline ?? 0,
        yourGuess: round.guess[seat],
        theirGuess: round.guess[other],
        yourRating: round.rating[seat],
        theirRating: round.rating[other],
      };
    }
    const yours = tally(state, seat);
    const theirs = tally(state, other);
    return {
      phase: "done",
      rounds,
      yours,
      theirs,
      verdict: verdict(yours, theirs),
      rows: state.rounds.map((round, i) => ({
        question: state.questions[i]!,
        yourGuess: round.guess[seat],
        theirGuess: round.guess[other],
        rating: round.rating[other],
      })),
    };
  },

  isDone: (state) => state.phase === "done",
};

export const IMPRESSIONS_RATING_LABEL: Record<ImpressionsRating, string> = {
  spot: "Spot on",
  close: "Close",
  off: "Way off",
};

export const IMPRESSIONS_VERDICT_LABEL: Record<ImpressionsVerdict, string> = {
  well: "You read each other well",
  surprises: "Full of surprises",
  mystery: "Still a mystery to each other",
};
