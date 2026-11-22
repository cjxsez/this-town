import test from "node:test";
import assert from "node:assert/strict";
import {
  IMPRESSIONS_DECK,
  IMPRESSIONS_ROUNDS,
  impressionsGame,
  impressionsSnap,
  impressionsStart,
  type ImpressionsState,
} from "../src/games/impressions";

let seed = 0.37;
const ctxAt = (now: number) => ({ now, rand: () => (seed = (seed * 9301 + 0.49297) % 1) });

function playing(now = 0): ImpressionsState {
  let s = impressionsGame.init(ctxAt(now), undefined);
  s = impressionsGame.reduce(s, "a", { type: "ready" }, ctxAt(now));
  return impressionsGame.reduce(s, "b", { type: "ready" }, ctxAt(now));
}

const q0 = (s: ImpressionsState) => s.questions[s.round]!;

test("every deck question has a sane slider range", () => {
  for (const q of IMPRESSIONS_DECK) {
    assert.ok(q.min < q.max && q.step > 0, q.id);
    assert.ok(Number.isInteger(Math.round((q.max - q.min) / q.step)), q.id);
  }
});

test("a game draws five different questions, at least two about Boston", () => {
  for (let i = 0; i < 20; i++) {
    const s = impressionsGame.init(ctxAt(0), undefined);
    assert.equal(s.questions.length, IMPRESSIONS_ROUNDS);
    assert.equal(new Set(s.questions.map((q) => q.id)).size, IMPRESSIONS_ROUNDS);
    assert.ok(s.questions.filter((q) => q.boston).length >= 2);
  }
});

test("slider values snap to the question's steps and stay in range", () => {
  const q = { ...IMPRESSIONS_DECK[0]!, min: 0, max: 10, step: 2 };
  assert.equal(impressionsSnap(q, 3.1), 4);
  assert.equal(impressionsSnap(q, -5), 0);
  assert.equal(impressionsSnap(q, 99), 10);
  assert.equal(impressionsStart(q), 6); // the middle, 5, snaps up to the step at 6
});

test("both players ready starts round one with both sliders in the middle", () => {
  const s = playing();
  assert.equal(s.phase, "guess");
  assert.equal(s.round, 0);
  assert.equal(s.draft.a, impressionsStart(q0(s)));
  assert.equal(s.draft.a, s.draft.b);
});

test("while guessing, a player never sees where the other's slider is", () => {
  let s = playing();
  const q = q0(s);
  s = impressionsGame.reduce(s, "b", { type: "slide", value: q.max }, ctxAt(1));
  const va = impressionsGame.view(s, "a");
  assert.equal(va.phase, "guess");
  assert.ok(!JSON.stringify(va).includes(`"theirValue"`));
  assert.equal((va as { yourValue: number }).yourValue, impressionsStart(q));
});

test("locking in both guesses moves to talk, where both see both guesses", () => {
  let s = playing();
  const q = q0(s);
  s = impressionsGame.reduce(s, "a", { type: "lock", value: q.min }, ctxAt(1));
  assert.equal(s.phase, "guess");
  assert.equal(impressionsGame.reduce(s, "a", { type: "slide", value: q.max }, ctxAt(1)), s, "a locked guess can't move");
  s = impressionsGame.reduce(s, "b", { type: "lock", value: q.max }, ctxAt(1));
  assert.equal(s.phase, "talk");
  const vb = impressionsGame.view(s, "b") as { yourGuess: number; theirGuess: number };
  assert.equal(vb.yourGuess, q.max);
  assert.equal(vb.theirGuess, q.min);
});

test("when the guess clock runs out, the slider's last position is taken", () => {
  let s = playing(0);
  const q = q0(s);
  s = impressionsGame.reduce(s, "a", { type: "slide", value: q.max }, ctxAt(1));
  s = impressionsGame.tick(s, ctxAt(60_000));
  assert.equal(s.phase, "talk");
  assert.equal(s.rounds[0]!.guess.a, q.max);
});

test("non-numbers and server actions are ignored", () => {
  const s = playing();
  assert.equal(impressionsGame.reduce(s, "a", { type: "slide", value: Number.NaN }, ctxAt(1)), s);
  assert.equal(impressionsGame.reduce(s, "a", { type: "lock", value: "7" }, ctxAt(1)), s);
  assert.equal(impressionsGame.reduce(s, "server", { type: "lock", value: 1 }, ctxAt(1)), s);
});

test("once both have rated, the round ends a few seconds later; a changed rating doesn't extend it", () => {
  let s = playing(0);
  s = impressionsGame.reduce(s, "a", { type: "lock", value: 0 }, ctxAt(1));
  s = impressionsGame.reduce(s, "b", { type: "lock", value: 0 }, ctxAt(1));
  const talkDeadline = s.deadline!;
  s = impressionsGame.reduce(s, "a", { type: "rate", rating: "spot" }, ctxAt(2));
  assert.equal(s.deadline, talkDeadline);
  s = impressionsGame.reduce(s, "b", { type: "rate", rating: "close" }, ctxAt(2));
  const short = s.deadline!;
  assert.ok(short < talkDeadline);
  s = impressionsGame.reduce(s, "b", { type: "rate", rating: "off" }, ctxAt(3));
  assert.equal(s.deadline, short);
  assert.equal(impressionsGame.reduce(s, "a", { type: "rate", rating: "great" }, ctxAt(3)), s);
});

test("after five rounds the game is done with tallies and a verdict for each side", () => {
  let s = playing(0);
  let now = 0;
  for (let r = 0; r < IMPRESSIONS_ROUNDS; r++) {
    s = impressionsGame.reduce(s, "a", { type: "lock", value: 0 }, ctxAt(++now));
    s = impressionsGame.reduce(s, "b", { type: "lock", value: 0 }, ctxAt(now));
    s = impressionsGame.reduce(s, "a", { type: "rate", rating: "spot" }, ctxAt(now)); // a says b's guess was spot on
    s = impressionsGame.reduce(s, "b", { type: "rate", rating: "close" }, ctxAt(now));
    now += 10_000;
    s = impressionsGame.tick(s, ctxAt(now));
  }
  assert.equal(impressionsGame.isDone(s), true);
  const va = impressionsGame.view(s, "a") as { yours: object; theirs: object; verdict: string; rows: unknown[] };
  assert.deepEqual(va.yours, { spot: 0, close: IMPRESSIONS_ROUNDS, off: 0 }); // b rated a's guesses "close"
  assert.deepEqual(va.theirs, { spot: IMPRESSIONS_ROUNDS, close: 0, off: 0 });
  assert.equal(va.verdict, "well");
  assert.equal(va.rows.length, IMPRESSIONS_ROUNDS);
});

test("with no ratings at all the verdict is still a mystery", () => {
  let s = playing(0);
  let now = 0;
  for (let r = 0; r < IMPRESSIONS_ROUNDS; r++) {
    now += 100_000;
    s = impressionsGame.tick(s, ctxAt(now)); // guess times out
    now += 100_000;
    s = impressionsGame.tick(s, ctxAt(now)); // talk times out
  }
  assert.equal((impressionsGame.view(s, "b") as { verdict: string }).verdict, "mystery");
});
