import test from "node:test";
import assert from "node:assert/strict";
import { triviaFromLine, triviaGame, type TriviaView } from "@questline/protocol/games";
import type { SharedStore } from "../src/games/hooks";
import { pickTrivia, saveLeft } from "../src/games/trivia";

function memoryStore(): SharedStore {
  const data = new Map<string, unknown>();
  return {
  get: async <T>(key: string) => (data.get(key) as T | undefined) ?? null,
  put: async (key, value) => void data.set(key, value),
  };
}

const card = { q: "Which line runs to Wonderland?", a: "Blue Line", decoys: ["Red Line", "Orange Line", "Green Line"] };
const ctx = { now: 1000, rand: () => 0.5 };

function firstQuestion(seed: unknown): Extract<TriviaView, { phase: "question" }> {
  let state = triviaGame.init(ctx, seed);
  state = triviaGame.reduce(state, "a", { type: "ready" }, ctx);
  state = triviaGame.reduce(state, "b", { type: "ready" }, ctx);
  return triviaGame.view(state, "a") as Extract<TriviaView, { phase: "question" }>;
}

test("a left trivia question says who left a question when the room knew the pair's names", async () => {
  const shared = memoryStore();
  await saveLeft(shared, card, 1, "Maya and Sam");
  const view = firstQuestion(await pickTrivia(shared, ctx.rand));
  assert.equal(view.q, card.q);
  assert.equal(view.by, "Maya and Sam");
  assert.equal(triviaFromLine(view), "Left for you by Maya and Sam");
});

test("a left trivia question has no name when the pair played without names", async () => {
  const shared = memoryStore();
  await saveLeft(shared, card, 1);
  const view = firstQuestion(await pickTrivia(shared, ctx.rand));
  assert.equal(view.from, "pair");
  assert.equal(view.by, null);
  assert.equal(triviaFromLine(view), "Left by a pair before you");
});

test("a starter trivia question never carries a name", () => {
  const view = firstQuestion({ questions: [{ ...card, left: false, by: "Maya and Sam" }] });
  assert.equal(view.by, null);
  assert.equal(triviaFromLine(view), "From the starter deck");
});
