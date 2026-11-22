import test from "node:test";
import assert from "node:assert/strict";
import { applyEndVote, canAcceptEndVote, endChoiceFromAction } from "../src/games/votes";

test("endChoiceFromAction: finish only on the last game; next there counts as finish", () => {
  assert.equal(endChoiceFromAction(false, "room.finish"), null);
  assert.equal(endChoiceFromAction(false, "room.next"), "next");
  assert.equal(endChoiceFromAction(false, "room.again"), "again");
  assert.equal(endChoiceFromAction(true, "room.finish"), "finish");
  assert.equal(endChoiceFromAction(true, "room.next"), "finish");
  assert.equal(endChoiceFromAction(true, "room.again"), "finish");
});

test("applyEndVote waits on a lone or split pick, agrees when both match", () => {
  const a = applyEndVote({}, "a", "next");
  assert.deepEqual(a.votes, { a: "next" });
  assert.equal(a.consensus, null);

  const split = applyEndVote(a.votes, "b", "again");
  assert.deepEqual(split.votes, { a: "next", b: "again" });
  assert.equal(split.consensus, null);

  const agreed = applyEndVote(a.votes, "b", "next");
  assert.equal(agreed.consensus, "next");

  const finish = applyEndVote({ a: "finish" }, "b", "finish");
  assert.equal(finish.consensus, "finish");
});

test("canAcceptEndVote: finish cannot be undone", () => {
  assert.equal(canAcceptEndVote(false, true), true);
  assert.equal(canAcceptEndVote(true, true), false);
  assert.equal(canAcceptEndVote(false, false), false);
});
