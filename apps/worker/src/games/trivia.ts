/**
 * games/trivia.ts (worker): the hooks for "Left for you" (protocol games/trivia.ts).
 *
 * - `prepare`: picks this game's three questions. The newest question an earlier pair left
 *   is always first, then others they left at random, then starter questions to make three.
 * - `effect`: when a pair submits a question (the state enters "writing"), asks the LLM
 *   for three wrong answers (llm/decoys.ts). If the question is kept it is added to the
 *   shared list, and the outcome goes back to the module as a "written" action.
 *
 * The shared list (key `trivia:left`, newest first, at most LEFT_MAX) holds the question,
 * its answers, a timestamp and, when the room was opened for a matched pair, their first
 * names ("Maya and Sam") so the next pair sees who left it. Nothing else about them.
 */
import {
  TRIVIA_MAX_BY,
  TRIVIA_ROUNDS,
  TRIVIA_STARTERS,
  triviaCardOk,
  triviaClean,
  type TriviaCard,
  type TriviaSeed,
  type TriviaServerAction,
  type TriviaState,
} from "@questline/protocol/games";
import type { Env } from "../env";
import { writeDecoys, type DecoyResult } from "../llm/decoys";
import type { GameHooks, SharedStore } from "./hooks";

export const LEFT_KEY = "trivia:left";
export const LEFT_MAX = 30;
/** Keep the "Writing the wrong answers" screen up long enough to read. */
const MIN_WRITING_MS = 1500;

export interface LeftQuestion extends TriviaCard {
  /** When it was left, epoch ms. */
  at: number;
  /** First names of the pair who left it. Missing when the room had no names. */
  by?: string;
}

function shuffled<T>(items: T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

async function readLeft(shared: SharedStore): Promise<LeftQuestion[]> {
  const raw = await shared.get<unknown>(LEFT_KEY);
  return Array.isArray(raw) ? (raw.filter(triviaCardOk) as LeftQuestion[]) : [];
}

export async function pickTrivia(shared: SharedStore, rand: () => number = Math.random): Promise<TriviaSeed> {
  let left: LeftQuestion[] = [];
  try {
    left = await readLeft(shared);
  } catch (err) {
    console.error("trivia: could not read left questions", err);
  }
  const [newest, ...older] = left;
  const fromPairs = newest ? [newest, ...shuffled(older, rand)].slice(0, TRIVIA_ROUNDS) : [];
  const questions: TriviaSeed["questions"] = fromPairs.map(({ q, a, decoys, by }) => ({ q, a, decoys, left: true, ...(by && { by }) }));
  const used = new Set(questions.map((c) => c.q.toLowerCase()));
  for (const card of shuffled(TRIVIA_STARTERS, rand)) {
    if (questions.length >= TRIVIA_ROUNDS) break;
    if (!used.has(card.q.toLowerCase())) questions.push({ ...card, left: false });
  }
  return { questions };
}

/** Put a kept question at the front of the shared list, dropping an older copy of the same question. */
export async function saveLeft(shared: SharedStore, card: TriviaCard, now: number, names: string | null = null): Promise<void> {
  const left = await readLeft(shared);
  const rest = left.filter((c) => c.q.trim().toLowerCase() !== card.q.trim().toLowerCase());
  const by = triviaClean(names, TRIVIA_MAX_BY);
  const entry: LeftQuestion = { q: card.q, a: card.a, decoys: card.decoys, at: now, ...(by && { by }) };
  await shared.put(LEFT_KEY, [entry, ...rest].slice(0, LEFT_MAX));
}

/** Judge one submitted question and save it if it is kept. Never throws. */
export async function judgeAndSave(
  shared: SharedStore,
  draft: { q: string; a: string },
  tries: number,
  write: (q: string, a: string) => Promise<DecoyResult>,
  names: string | null = null,
): Promise<TriviaServerAction> {
  try {
    const out = await write(draft.q, draft.a);
    if (out.result !== "ok") return { type: "written", tries, result: out.result };
    const card: TriviaCard = { q: draft.q, a: draft.a, decoys: out.decoys };
    if (!triviaCardOk(card)) return { type: "written", tries, result: "failed" };
    await saveLeft(shared, card, Date.now(), names);
    return { type: "written", tries, result: "ok", decoys: out.decoys };
  } catch (err) {
    console.error("trivia: could not save the question", err);
    return { type: "written", tries, result: "failed" };
  }
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const triviaHooks: GameHooks = {
  prepare: (_env: Env, shared) => pickTrivia(shared),

  effect(env, shared, prev, next, room) {
    const before = prev as TriviaState | null;
    const after = next as TriviaState | null;
    // Only on the change into "writing", so one call per submission however often the room is polled.
    if (after?.phase !== "writing" || before?.phase === "writing" || !after.draft) return null;
    const job = judgeAndSave(shared, after.draft, after.tries, (q, a) => writeDecoys(env, q, a), room.names);
    return Promise.all([job, pause(MIN_WRITING_MS)]).then(([action]) => action);
  },
};
