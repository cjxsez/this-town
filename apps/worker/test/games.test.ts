import test from "node:test";
import assert from "node:assert/strict";
import { TRIVIA_ROUNDS, TRIVIA_STARTERS } from "@questline/protocol/games";
import type { DecoyResult } from "../src/llm/decoys";
import type { SharedStore } from "../src/games/hooks";
import { LEFT_KEY, LEFT_MAX, judgeAndSave, pickTrivia, saveLeft, type LeftQuestion } from "../src/games/trivia";

/** In-memory SharedStore for hook tests. */
function memoryStore(seed: Record<string, unknown> = {}): SharedStore {
  const data = new Map<string, unknown>(Object.entries(seed));
  return {
    async get<T>(key: string) {
      return (data.has(key) ? data.get(key) : null) as T | null;
    },
    async put(key: string, value: unknown) {
      data.set(key, value);
    },
  };
}

function card(q: string, a = "A", decoys = ["B", "C", "D"]): LeftQuestion {
  return { q, a, decoys, at: 1 };
}

/** Deterministic "shuffle": reverse, so order is stable in tests. */
const reverseRand = () => 0.99;

test("pickTrivia puts the newest left question first, then others, capped at TRIVIA_ROUNDS", async () => {
  const left: LeftQuestion[] = [
    card("Newest T fact?"),
    card("Older one?"),
    card("Oldest one?"),
    card("Extra left?"),
  ];
  left[0]!.at = 400;
  left[1]!.at = 300;
  left[2]!.at = 200;
  left[3]!.at = 100;
  // Store newest-first as saveLeft does.
  const shared = memoryStore({ [LEFT_KEY]: left });
  const seed = await pickTrivia(shared, reverseRand);
  assert.equal(seed.questions.length, TRIVIA_ROUNDS);
  assert.equal(seed.questions[0]!.q, "Newest T fact?");
  assert.equal(seed.questions[0]!.left, true);
  assert.ok(seed.questions.every((q) => q.left === true || q.left === false));
  assert.ok(seed.questions.filter((q) => q.left).length <= TRIVIA_ROUNDS);
});

test("pickTrivia fills the rest with starter questions when few were left", async () => {
  const shared = memoryStore({ [LEFT_KEY]: [card("Only left?")] });
  const seed = await pickTrivia(shared, reverseRand);
  assert.equal(seed.questions.length, TRIVIA_ROUNDS);
  assert.equal(seed.questions[0]!.q, "Only left?");
  assert.equal(seed.questions[0]!.left, true);
  assert.ok(seed.questions.slice(1).every((q) => q.left === false));
  const starterQs = new Set(TRIVIA_STARTERS.map((c) => c.q));
  assert.ok(starterQs.has(seed.questions[1]!.q));
});

test("saveLeft caps at LEFT_MAX and never stores who wrote it", async () => {
  const shared = memoryStore();
  for (let i = 0; i < LEFT_MAX + 5; i++) {
    await saveLeft(shared, { q: `Q${i}?`, a: "A", decoys: ["B", "C", "D"] }, 1000 + i);
  }
  const stored = (await shared.get<LeftQuestion[]>(LEFT_KEY))!;
  assert.equal(stored.length, LEFT_MAX);
  assert.equal(stored[0]!.q, `Q${LEFT_MAX + 4}?`);
  for (const entry of stored) {
    assert.deepEqual(Object.keys(entry).sort(), ["a", "at", "decoys", "q"]);
  }
});

test("judgeAndSave only stores accepted cards", async () => {
  const shared = memoryStore();
  const okWrite = async (): Promise<DecoyResult> => ({ result: "ok", decoys: ["X", "Y", "Z"] });
  const rejected = async (): Promise<DecoyResult> => ({ result: "rejected" });
  const failed = async (): Promise<DecoyResult> => ({ result: "failed" });

  const rejectedOut = await judgeAndSave(shared, { q: "Bad?", a: "Nope" }, 1, rejected);
  assert.equal(rejectedOut.result, "rejected");
  assert.equal(await shared.get(LEFT_KEY), null);

  const failedOut = await judgeAndSave(shared, { q: "Slow?", a: "Maybe" }, 1, failed);
  assert.equal(failedOut.result, "failed");
  assert.equal(await shared.get(LEFT_KEY), null);

  const okOut = await judgeAndSave(shared, { q: "Which line is orange?", a: "Orange" }, 1, okWrite);
  assert.equal(okOut.result, "ok");
  if (okOut.result !== "ok") throw new Error("expected ok");
  assert.deepEqual(okOut.decoys, ["X", "Y", "Z"]);
  const stored = (await shared.get<LeftQuestion[]>(LEFT_KEY))!;
  assert.equal(stored.length, 1);
  assert.equal(stored[0]!.q, "Which line is orange?");
  assert.deepEqual(Object.keys(stored[0]!).sort(), ["a", "at", "decoys", "q"]);
});
