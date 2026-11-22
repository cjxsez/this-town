/**
 * games/trivia.ts: "Left for you". The pair answers three trivia questions left by the
 * pairs before them (as a team, with one shared pick), then leaves one about the T or
 * Boston for the next pair.
 *
 *   intro    -> both tap ready
 *   question -> four choices, one shared highlight; either seat moves it and locks it in
 *   reveal   -> the right answer, a few seconds, then the next question
 *   leave    -> either seat types a question and its answer (or skips)
 *   writing  -> the worker asks the LLM for three wrong answers and whether it can be kept
 *   result   -> the finished card (or why it was not kept), the score, and the End buttons
 *
 * The module is pure. The worker's hooks (apps/worker/src/games/trivia.ts) pick the
 * questions (the `seed` for init) and, when the state enters "writing", do the LLM call
 * and feed the outcome back as a "server" action of type "written".
 */
import { TRIVIA_MAX_BY, TRIVIA_STARTERS, type TriviaCard } from "./trivia-deck";
import type { Actor, GameCtx, GameModule, Seat } from "./types";

export * from "./trivia-deck";

export const TRIVIA_ROUNDS = 3;
export const TRIVIA_QUESTION_MS = 25_000;
export const TRIVIA_REVEAL_MS = 6_000;
export const TRIVIA_LEAVE_MS = 90_000;
/** If the worker never answers, give up on saving after this long. */
export const TRIVIA_WRITING_MS = 15_000;
export const TRIVIA_MAX_QUESTION = 120;
export const TRIVIA_MIN_QUESTION = 8;
export const TRIVIA_MAX_ANSWER = 40;
/** A pair may submit this many times (one retry after a rejected question). */
export const TRIVIA_MAX_TRIES = 2;

/** What prepare hands to init: the questions for this game, in the order they are asked. */
export interface TriviaSeed {
  questions: (TriviaCard & { left: boolean; by?: string })[];
}

export interface TriviaQuestion {
  q: string;
  choices: string[];
  /** Index of the right choice. */
  answer: number;
  /** Left by an earlier pair (true) or from the starter deck (false). */
  left: boolean;
  /** First names of the pair who left it ("Maya and Sam"), when they are known. */
  by: string | null;
}

export type TriviaOutcome = "saved" | "rejected" | "failed" | "skipped";

export interface TriviaState {
  phase: "intro" | "question" | "reveal" | "leave" | "writing" | "result";
  ready: Record<Seat, boolean>;
  questions: TriviaQuestion[];
  index: number;
  /** The shared highlight on the current question. */
  cursor: number;
  /** What the pair locked in for each question so far; null when time ran out. */
  picked: (number | null)[];
  /** Server time the current phase ends, or null when it waits for the players. */
  deadline: number | null;
  /** Who started typing first in the leave phase. */
  writer: Seat | null;
  /** How many questions the pair has submitted. */
  tries: number;
  draft: { q: string; a: string } | null;
  outcome: TriviaOutcome | null;
  /** The saved question with its four choices. */
  card: { q: string; choices: string[]; answer: number } | null;
}

interface Progress {
  index: number;
  total: number;
  /** "pair": left by an earlier pair. "deck": a starter question. */
  from: "pair" | "deck";
  /** First names of the pair who left it, or null (a starter, or a pair who played without names). */
  by: string | null;
  q: string;
  choices: string[];
}

export type TriviaView =
  | { phase: "intro"; youReady: boolean; theyReady: boolean; total: number }
  | (Progress & { phase: "question"; cursor: number; deadline: number })
  | (Progress & { phase: "reveal"; answer: number; picked: number | null; score: number; deadline: number })
  | { phase: "leave"; writer: "you" | "partner" | null; retry: boolean; deadline: number }
  | { phase: "writing"; q: string; a: string }
  | {
      phase: "result";
      outcome: TriviaOutcome;
      card: { q: string; choices: string[]; answer: number } | null;
      draft: { q: string; a: string } | null;
      score: number;
      total: number;
    };

/** What the screens send. `q` is the question index the player was looking at. */
export type TriviaAction =
  | { type: "ready" }
  | { type: "move"; q: number; to: number }
  | { type: "move"; q: number; by: 1 | -1 }
  | { type: "lock"; q: number; choice: number }
  | { type: "next"; q: number }
  | { type: "typing" }
  | { type: "leave"; question: string; answer: string }
  | { type: "skip" };

/** What the worker's effect sends back. `tries` says which submission it answers. */
export type TriviaServerAction =
  | { type: "written"; tries: number; result: "ok"; decoys: string[] }
  | { type: "written"; tries: number; result: "rejected" | "failed" };

function shuffled<T>(items: T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** One line, single spaces, no control characters. */
export function triviaClean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

/** True when a card is well formed: a question, an answer, three distinct wrong answers. */
export function triviaCardOk(card: unknown): card is TriviaCard {
  const c = card as Partial<TriviaCard> | null;
  if (!c || typeof c.q !== "string" || typeof c.a !== "string" || !Array.isArray(c.decoys)) return false;
  if (!c.q.trim() || !c.a.trim() || c.decoys.length !== 3) return false;
  const all = [c.a, ...c.decoys];
  if (!all.every((s) => typeof s === "string" && s.trim() !== "")) return false;
  return new Set(all.map((s) => s.trim().toLowerCase())).size === 4;
}

function toQuestion(card: TriviaCard, left: boolean, rand: () => number, by: unknown = null): TriviaQuestion {
  const choices = shuffled([card.a, ...card.decoys], rand);
  return { q: card.q, choices, answer: choices.indexOf(card.a), left, by: (left && triviaClean(by, TRIVIA_MAX_BY)) || null };
}

/** For the demo: who a question is from when no names came with it (starters, and ones left before names were kept). */
export const TRIVIA_DEFAULT_BY = "Andres and Kenny";

/** The line under the question count: who this question is from. */
export function triviaFromLine(view: { by: string | null }): string {
  return `Left for you by ${view.by ?? TRIVIA_DEFAULT_BY}`;
}

function pickQuestions(seed: unknown, rand: () => number): TriviaQuestion[] {
  const given = (seed as Partial<TriviaSeed> | null)?.questions;
  const cards = (Array.isArray(given) ? given : []).filter(triviaCardOk).slice(0, TRIVIA_ROUNDS);
  const out = cards.map((c) => {
    const given = c as { left?: unknown; by?: unknown };
    return toQuestion(c, given.left === true, rand, given.by);
  });
  // No seed, or a short one: top up from the starter deck.
  const used = new Set(out.map((c) => c.q.toLowerCase()));
  for (const card of shuffled(TRIVIA_STARTERS, rand)) {
    if (out.length >= TRIVIA_ROUNDS) break;
    if (!used.has(card.q.toLowerCase())) out.push(toQuestion(card, false, rand));
  }
  return out;
}

function score(state: TriviaState): number {
  return state.picked.filter((p, i) => p !== null && p === state.questions[i]?.answer).length;
}

function ask(state: TriviaState, index: number, ctx: GameCtx): TriviaState {
  if (index >= state.questions.length) {
    return { ...state, phase: "leave", index, deadline: ctx.now + TRIVIA_LEAVE_MS };
  }
  return { ...state, phase: "question", index, cursor: 0, deadline: ctx.now + TRIVIA_QUESTION_MS };
}

function answer(state: TriviaState, choice: number | null, ctx: GameCtx): TriviaState {
  const picked = state.picked.slice(0, state.index);
  picked[state.index] = choice;
  return { ...state, phase: "reveal", picked, deadline: ctx.now + TRIVIA_REVEAL_MS };
}

function finish(state: TriviaState, outcome: TriviaOutcome, card: TriviaState["card"] = null): TriviaState {
  return { ...state, phase: "result", outcome, card, deadline: null };
}

const isChoice = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 3;

export const triviaGame: GameModule<TriviaState, TriviaView> = {
  id: "trivia",
  title: "Left for you",

  init(ctx, seed) {
    return {
      phase: "intro",
      ready: { a: false, b: false },
      questions: pickQuestions(seed, ctx.rand),
      index: 0,
      cursor: 0,
      picked: [],
      deadline: null,
      writer: null,
      tries: 0,
      draft: null,
      outcome: null,
      card: null,
    };
  },

  reduce(state, from: Actor, action, ctx) {
    const act = action as Record<string, unknown> | null;
    if (!act || typeof act !== "object" || typeof act.type !== "string") return state;

    if (from === "server") {
      if (act.type !== "written" || state.phase !== "writing" || act.tries !== state.tries || !state.draft) return state;
      if (act.result === "ok") {
        const card = { q: state.draft.q, a: state.draft.a, decoys: act.decoys };
        if (!triviaCardOk(card)) return finish(state, "failed");
        const made = toQuestion(card, true, ctx.rand);
        return finish(state, "saved", { q: made.q, choices: made.choices, answer: made.answer });
      }
      if (act.result === "rejected") {
        if (state.tries >= TRIVIA_MAX_TRIES) return finish(state, "rejected");
        return { ...state, phase: "leave", deadline: ctx.now + TRIVIA_LEAVE_MS };
      }
      return finish(state, "failed");
    }

    switch (state.phase) {
      case "intro": {
        if (act.type !== "ready" || state.ready[from]) return state;
        const ready = { ...state.ready, [from]: true };
        return ready.a && ready.b ? ask({ ...state, ready }, 0, ctx) : { ...state, ready };
      }
      case "question": {
        if (act.q !== state.index) return state;
        if (act.type === "move") {
          const to = isChoice(act.to) ? act.to : act.by === 1 || act.by === -1 ? state.cursor + act.by : -1;
          if (!isChoice(to) || to >= state.questions[state.index]!.choices.length || to === state.cursor) return state;
          return { ...state, cursor: to };
        }
        if (act.type === "lock" && isChoice(act.choice)) return answer({ ...state, cursor: act.choice }, act.choice, ctx);
        return state;
      }
      case "reveal":
        return act.type === "next" && act.q === state.index ? ask(state, state.index + 1, ctx) : state;
      case "leave": {
        if (act.type === "skip") return finish(state, state.tries > 0 ? "rejected" : "skipped");
        if (act.type === "typing") return state.writer ? state : { ...state, writer: from };
        if (act.type !== "leave") return state;
        const q = triviaClean(act.question, TRIVIA_MAX_QUESTION);
        const a = triviaClean(act.answer, TRIVIA_MAX_ANSWER);
        if (q.length < TRIVIA_MIN_QUESTION || !a) return state;
        return {
          ...state,
          phase: "writing",
          writer: state.writer ?? from,
          draft: { q, a },
          tries: state.tries + 1,
          deadline: ctx.now + TRIVIA_WRITING_MS,
        };
      }
      default:
        return state;
    }
  },

  tick(state, ctx) {
    if (state.deadline === null || ctx.now < state.deadline) return state;
    switch (state.phase) {
      case "question":
        return answer(state, null, ctx);
      case "reveal":
        return ask(state, state.index + 1, ctx);
      case "leave":
        return finish(state, state.tries > 0 ? "rejected" : "skipped");
      case "writing":
        return finish(state, "failed");
      default:
        return state;
    }
  },

  view(state, seat) {
    const total = state.questions.length;
    switch (state.phase) {
      case "intro":
        return { phase: "intro", youReady: state.ready[seat], theyReady: state.ready[seat === "a" ? "b" : "a"], total };
      case "question":
      case "reveal": {
        const question = state.questions[state.index]!;
        const progress: Progress = {
          index: state.index,
          total,
          from: question.left ? "pair" : "deck",
          by: question.by ?? null,
          q: question.q,
          choices: question.choices,
        };
        if (state.phase === "question") return { ...progress, phase: "question", cursor: state.cursor, deadline: state.deadline ?? 0 };
        return {
          ...progress,
          phase: "reveal",
          answer: question.answer,
          picked: state.picked[state.index] ?? null,
          score: score(state),
          deadline: state.deadline ?? 0,
        };
      }
      case "leave":
        return {
          phase: "leave",
          writer: state.writer === null ? null : state.writer === seat ? "you" : "partner",
          retry: state.tries > 0,
          deadline: state.deadline ?? 0,
        };
      case "writing":
        return { phase: "writing", q: state.draft?.q ?? "", a: state.draft?.a ?? "" };
      case "result":
        return {
          phase: "result",
          outcome: state.outcome ?? "skipped",
          card: state.card,
          draft: state.draft,
          score: score(state),
          total,
        };
    }
  },

  isDone: (state) => state.phase === "result",
};
