import test from "node:test";
import assert from "node:assert/strict";
import { applyEndVote, canAcceptEndVote, endChoiceFromAction } from "@questline/protocol/games";

/** Worker-side smoke that the protocol vote helpers still resolve the D29 cases. */
test("D29: both must pick the same; a split waits; finish cannot be undone", () => {
  assert.equal(endChoiceFromAction(true, "room.next"), "finish");
  const waiting = applyEndVote({}, "a", "finish");
  assert.equal(waiting.consensus, null);
  const split = applyEndVote({ a: "finish" }, "b", "again");
  // on last game "again" is remapped before apply; here we assert split of raw choices
  assert.equal(split.consensus, null);
  const done = applyEndVote({ a: "finish" }, "b", "finish");
  assert.equal(done.consensus, "finish");
  assert.equal(canAcceptEndVote(true, true), false);
});
