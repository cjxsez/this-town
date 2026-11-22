import test from "node:test";
import assert from "node:assert/strict";
import {
  TRIVIA_MAX_TRIES,
  TRIVIA_QUESTION_MS,
  TRIVIA_ROUNDS,
  TRIVIA_STARTERS,
  TRIVIA_WRITING_MS,
  triviaCardOk,
  triviaClean,
  triviaGame,
  type TriviaState,
} from "../src/games/trivia";

const ctxAt = (now: number) => ({ now, rand: () => 0.42 });
const LEFT = { q: "Which line goes to Wonderland?", a: "Blue", decoys: ["Red", "Orange", "Green"], left: true };

function playing(seed: unknown = undefined): TriviaState {
  let s = triviaGame.init(ctxAt(0), seed);
  s = triviaGame.reduce(s, "a", { type: "ready" }, ctxAt(0));
  return triviaGame.reduce(s, "b", { type: "ready" }, ctxAt(0));
}

/** Answer every question right, step past each reveal, and land on "leave". */
function toLeave(s: TriviaState): TriviaState {
  for (let i = 0; i < s.questions.length; i++) {
    s = triviaGame.reduce(s, "a", { type: "lock", q: i, choice: s.questions[i]!.answer }, ctxAt(1));
    s = triviaGame.reduce(s, "b", { type: "next", q: i }, ctxAt(1));
  }
  return s;
}

test("every starter card is well formed", () => {
  for (const c of TRIVIA_STARTERS) assert.ok(triviaCardOk(c), c.q);
});

test("cards need a question, an answer and three distinct wrong answers", () => {
  assert.equal(triviaCardOk(LEFT), true);
  assert.equal(triviaCardOk({ ...LEFT, decoys: ["Red", "Red", "Green"] }), false);
  assert.equal(triviaCardOk({ ...LEFT, decoys: ["blue", "Red", "Green"] }), false, "a decoy equal to the answer, ignoring case");
  assert.equal(triviaCardOk({ ...LEFT, decoys: ["Red", "Green"] }), false);
  assert.equal(triviaCardOk({ ...LEFT, q: "  " }), false);
  assert.equal(triviaCardOk(null), false);
});

test("typed text is cleaned to one line and capped", () => {
  assert.equal(triviaClean("  Which\nline\t\tis   it? ", 100), "Which line is it?");
  assert.equal(triviaClean("abcdef", 3), "abc");
  assert.equal(triviaClean(42, 10), "");
});

test("questions left by earlier pairs come first, starters fill the rest", () => {
  const s = triviaGame.init(ctxAt(0), { questions: [LEFT] });
  assert.equal(s.questions.length, TRIVIA_ROUNDS);
  assert.equal(s.questions[0]!.q, LEFT.q);
  assert.equal(s.questions[0]!.left, true);
  assert.ok(s.questions.slice(1).every((q) => !q.left));
  assert.equal(new Set(s.questions.map((q) => q.q)).size, TRIVIA_ROUNDS, "no question twice");
});

test("a broken left question is dropped instead of shown", () => {
  const s = triviaGame.init(ctxAt(0), { questions: [{ ...LEFT, decoys: ["x"] }] });
  assert.ok(s.questions.every((q) => q.q !== LEFT.q));
});

test("the right answer is where the shuffle put it, and the question screen doesn't give it away", () => {
  const s = playing({ questions: [LEFT] });
  const q = s.questions[0]!;
  assert.equal(q.choices[q.answer], "Blue");
  assert.ok(!("answer" in triviaGame.view(s, "a")));
});

test("either seat moves the one shared highlight, within the four choices", () => {
  let s = playing();
  s = triviaGame.reduce(s, "a", { type: "move", q: 0, by: 1 }, ctxAt(1));
  assert.equal(s.cursor, 1);
  s = triviaGame.reduce(s, "b", { type: "move", q: 0, to: 3 }, ctxAt(1));
  assert.equal(s.cursor, 3);
  assert.equal(triviaGame.reduce(s, "a", { type: "move", q: 0, by: 1 }, ctxAt(1)), s, "can't go past the last choice");
  assert.equal(triviaGame.reduce(s, "a", { type: "move", q: 1, to: 0 }, ctxAt(1)), s, "a move for another question is stale");
});

test("locking an answer reveals it and counts the score", () => {
  let s = playing();
  const right = s.questions[0]!.answer;
  s = triviaGame.reduce(s, "b", { type: "lock", q: 0, choice: right }, ctxAt(1));
  const v = triviaGame.view(s, "a") as { phase: string; picked: number; score: number; answer: number };
  assert.equal(v.phase, "reveal");
  assert.equal(v.picked, right);
  assert.equal(v.score, 1);
});

test("no answer in time counts as no pick", () => {
  let s = playing();
  s = triviaGame.tick(s, ctxAt(TRIVIA_QUESTION_MS));
  assert.equal(s.phase, "reveal");
  assert.equal(s.picked[0], null);
});

test("after the last question the pair is asked to leave one, with every right answer counted", () => {
  const s = toLeave(playing());
  assert.equal(s.phase, "leave");
  assert.deepEqual(s.picked, s.questions.map((q) => q.answer));
});

test("whoever starts typing first is the writer, and the other sees their partner is writing", () => {
  let s = toLeave(playing());
  s = triviaGame.reduce(s, "b", { type: "typing" }, ctxAt(2));
  s = triviaGame.reduce(s, "a", { type: "typing" }, ctxAt(2));
  assert.equal(s.writer, "b");
  assert.equal((triviaGame.view(s, "a") as { writer: string }).writer, "partner");
});

test("a too-short question or a blank answer is not submitted", () => {
  const s = toLeave(playing());
  assert.equal(triviaGame.reduce(s, "a", { type: "leave", question: "Why?", answer: "Because" }, ctxAt(2)), s);
  assert.equal(triviaGame.reduce(s, "a", { type: "leave", question: "Which line is green?", answer: "   " }, ctxAt(2)), s);
});

test("the model's wrong answers turn the question into a saved card", () => {
  let s = toLeave(playing());
  s = triviaGame.reduce(s, "a", { type: "leave", question: "Oldest subway in America?", answer: "Tremont St" }, ctxAt(2));
  assert.equal(s.phase, "writing");
  assert.equal(s.tries, 1);
  s = triviaGame.reduce(s, "server", { type: "written", tries: 1, result: "ok", decoys: ["NYC IRT", "Chicago L", "Philly El"] }, ctxAt(3));
  assert.equal(s.phase, "result");
  assert.equal(s.outcome, "saved");
  assert.equal(s.card!.choices[s.card!.answer], "Tremont St");
});

test("bad decoys from the model fail the save instead of storing a broken card", () => {
  let s = toLeave(playing());
  s = triviaGame.reduce(s, "a", { type: "leave", question: "Oldest subway in America?", answer: "Tremont St" }, ctxAt(2));
  s = triviaGame.reduce(s, "server", { type: "written", tries: 1, result: "ok", decoys: ["Tremont St", "x", "y"] }, ctxAt(3));
  assert.equal(s.outcome, "failed");
});

test("a rejected question gets one retry, then the game ends as rejected", () => {
  let s = toLeave(playing());
  const submit = (st: TriviaState, now: number) =>
    triviaGame.reduce(st, "a", { type: "leave", question: "Something off topic here?", answer: "Yes" }, ctxAt(now));
  s = submit(s, 2);
  s = triviaGame.reduce(s, "server", { type: "written", tries: 1, result: "rejected" }, ctxAt(3));
  assert.equal(s.phase, "leave");
  assert.equal((triviaGame.view(s, "a") as { retry: boolean }).retry, true);
  s = submit(s, 4);
  assert.equal(s.tries, TRIVIA_MAX_TRIES);
  s = triviaGame.reduce(s, "server", { type: "written", tries: 2, result: "rejected" }, ctxAt(5));
  assert.equal(s.outcome, "rejected");
});

test("an answer for an older submission is ignored", () => {
  let s = toLeave(playing());
  s = triviaGame.reduce(s, "a", { type: "leave", question: "Oldest subway in America?", answer: "Tremont St" }, ctxAt(2));
  assert.equal(triviaGame.reduce(s, "server", { type: "written", tries: 0, result: "rejected" }, ctxAt(3)), s);
  assert.equal(triviaGame.reduce(s, "a", { type: "written", tries: 1, result: "ok", decoys: [] }, ctxAt(3)), s, "only the server can answer");
});

test("if the worker never answers, saving gives up", () => {
  let s = toLeave(playing());
  s = triviaGame.reduce(s, "a", { type: "leave", question: "Oldest subway in America?", answer: "Tremont St" }, ctxAt(2));
  s = triviaGame.tick(s, ctxAt(2 + TRIVIA_WRITING_MS));
  assert.equal(s.outcome, "failed");
});

test("skipping ends the game without leaving a question", () => {
  const s = triviaGame.reduce(toLeave(playing()), "b", { type: "skip" }, ctxAt(2));
  assert.equal(s.outcome, "skipped");
  assert.equal(triviaGame.isDone(s), true);
});
