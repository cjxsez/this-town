import test from "node:test";
import assert from "node:assert/strict";
import {
  taleGame,
  talePoints,
  taleSummary,
  TALE_THINK_MS,
  TALE_TELL_MS,
  TALE_VERDICT_MS,
  type TaleState,
} from "../src/games/tale";

/** A clock you move by hand and dice that return the given numbers in turn. */
function ctxAt(now: number, rolls: number[] = [0.1]) {
  let i = 0;
  return { now, rand: () => rolls[i++ % rolls.length]! };
}

/** a: fake, b: truth, a tells first. */
function started(now = 0): TaleState {
  return taleGame.init(ctxAt(now, [0.9, 0.1, 0.1, 0.1, 0.1]), undefined);
}

function toTell(s: TaleState, now: number) {
  s = taleGame.reduce(s, "a", { type: "ready", phase: "intro" }, ctxAt(now));
  s = taleGame.reduce(s, "b", { type: "ready", phase: "intro" }, ctxAt(now));
  s = taleGame.reduce(s, "a", { type: "ready", phase: "think" }, ctxAt(now));
  return taleGame.reduce(s, "b", { type: "ready", phase: "think" }, ctxAt(now));
}

test("init deals each seat a card and a spark and starts at the intro", () => {
  const s = started();
  assert.equal(s.phase, "intro");
  assert.deepEqual(s.cards, { a: "fake", b: "truth" });
  assert.ok(s.sparks.a && s.sparks.b);
  assert.deepEqual(s.order, ["a", "b"]);
  assert.equal(taleGame.isDone(s), false);
});

test("the intro waits for both players, then thinking starts with a timer", () => {
  let s = started();
  s = taleGame.reduce(s, "a", { type: "ready", phase: "intro" }, ctxAt(5));
  assert.equal(s.phase, "intro");
  s = taleGame.reduce(s, "b", { type: "ready", phase: "intro" }, ctxAt(5));
  assert.equal(s.phase, "think");
  assert.equal(s.deadline, 5 + TALE_THINK_MS);
});

test("a ready for the wrong phase, a repeated ready, or a server action changes nothing", () => {
  const s = started();
  assert.equal(taleGame.reduce(s, "a", { type: "ready", phase: "think" }, ctxAt(0)), s);
  assert.equal(taleGame.reduce(s, "server", { type: "ready", phase: "intro" }, ctxAt(0)), s);
  assert.equal(taleGame.reduce(s, "a", "nonsense", ctxAt(0)), s);
  const once = taleGame.reduce(s, "a", { type: "ready", phase: "intro" }, ctxAt(0));
  assert.equal(taleGame.reduce(once, "a", { type: "ready", phase: "intro" }, ctxAt(0)), once);
});

test("thinking ends by itself at the deadline and the first teller starts", () => {
  let s = started();
  s = taleGame.reduce(s, "a", { type: "ready", phase: "intro" }, ctxAt(0));
  s = taleGame.reduce(s, "b", { type: "ready", phase: "intro" }, ctxAt(0));
  assert.equal(taleGame.tick(s, ctxAt(TALE_THINK_MS - 1)), s);
  const t = taleGame.tick(s, ctxAt(TALE_THINK_MS));
  assert.equal(t.phase, "tell");
  assert.equal(t.turn, 0);
});

test("only the current teller can say done, and not in the first moments of the turn", () => {
  const s = toTell(started(), 0);
  assert.equal(taleGame.reduce(s, "b", { type: "done", turn: 0 }, ctxAt(10_000)), s, "b is not telling");
  assert.equal(taleGame.reduce(s, "a", { type: "done", turn: 0 }, ctxAt(500)), s, "a leftover tap is ignored");
  const next = taleGame.reduce(s, "a", { type: "done", turn: 0 }, ctxAt(10_000));
  assert.equal(next.turn, 1);
  assert.equal(next.deadline, 10_000 + TALE_TELL_MS);
});

test("each seat only sees its own card, and only while it is telling", () => {
  let s = toTell(started(), 0);
  assert.equal((taleGame.view(s, "a") as { card: string | null }).card, "fake");
  assert.equal((taleGame.view(s, "b") as { card: string | null }).card, null);
  s = taleGame.tick(s, ctxAt(TALE_TELL_MS));
  assert.equal((taleGame.view(s, "a") as { card: string | null }).card, null);
  assert.equal((taleGame.view(s, "b") as { card: string | null }).card, "truth");
});

test("after both stories, both call at once and the reveal shows the points", () => {
  let s = toTell(started(), 0);
  s = taleGame.tick(s, ctxAt(TALE_TELL_MS));
  s = taleGame.tick(s, ctxAt(2 * TALE_TELL_MS));
  assert.equal(s.phase, "verdict");
  const at = 2 * TALE_TELL_MS + 2000;
  s = taleGame.reduce(s, "b", { type: "call", call: "truth" }, ctxAt(at)); // a lied: b fooled
  assert.equal(s.phase, "verdict");
  assert.equal(taleGame.reduce(s, "b", { type: "call", call: "fake" }, ctxAt(at)), s, "a call can't be changed");
  s = taleGame.reduce(s, "a", { type: "call", call: "truth" }, ctxAt(at)); // b told the truth: a right
  assert.equal(s.phase, "reveal");
  assert.equal(taleGame.isDone(s), true);
  const va = taleGame.view(s, "a") as { youPoints: number; theyPoints: number; yours: { note: string } };
  assert.equal(va.youPoints, 2);
  assert.equal(va.theyPoints, 0);
  assert.equal(va.yours.note, "You fooled them");
});

test("calls ignore bad values and the first second of the verdict screen", () => {
  let s = toTell(started(), 0);
  s = taleGame.tick(taleGame.tick(s, ctxAt(TALE_TELL_MS)), ctxAt(2 * TALE_TELL_MS));
  assert.equal(taleGame.reduce(s, "a", { type: "call", call: "maybe" }, ctxAt(2 * TALE_TELL_MS + 5000)), s);
  assert.equal(taleGame.reduce(s, "a", { type: "call", call: "fake" }, ctxAt(2 * TALE_TELL_MS + 100)), s);
});

test("no call in time scores nothing on that story", () => {
  let s = toTell(started(), 0);
  s = taleGame.tick(taleGame.tick(s, ctxAt(TALE_TELL_MS)), ctxAt(2 * TALE_TELL_MS));
  s = taleGame.tick(s, ctxAt(2 * TALE_TELL_MS + TALE_VERDICT_MS));
  assert.equal(s.phase, "reveal");
  assert.equal(talePoints(s, "a"), 0);
  assert.equal(talePoints(s, "b"), 0);
  assert.equal(taleSummary(s), "Nobody made a call. The mystery lives on.");
});

test("points: a right call scores for the listener, a wrong call scores for the teller", () => {
  const cards = { a: "fake", b: "fake" } as const;
  assert.equal(talePoints({ cards, calls: { a: "fake", b: "truth" } }, "a"), 2);
  assert.equal(talePoints({ cards, calls: { a: "fake", b: "truth" } }, "b"), 0);
  assert.equal(taleSummary({ cards, calls: { a: "truth", b: "truth" } }), "Two liars, and both got away with it.");
  assert.equal(taleSummary({ cards: { a: "truth", b: "truth" }, calls: { a: "truth", b: "truth" } }), "All true. The T really is like that.");
});
