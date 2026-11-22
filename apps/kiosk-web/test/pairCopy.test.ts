import test from "node:test";
import assert from "node:assert/strict";
import { pairIncomingBody } from "../src/lib/pairCopy";

test("mission mode keeps the tap-starts-mission lines", () => {
  assert.equal(pairIncomingBody(0, false), "Tap the tag when you're both here.");
  assert.equal(pairIncomingBody(1, false), "One more tap on the tag starts your mission.");
  assert.equal(pairIncomingBody(2, false), "One more tap on the tag starts your mission.");
});

test("games-only mode never mentions a mission", () => {
  assert.match(pairIncomingBody(0, true), /phones or glasses/i);
  assert.match(pairIncomingBody(1, true), /phones or glasses/i);
  assert.doesNotMatch(pairIncomingBody(1, true), /mission/i);
  assert.doesNotMatch(pairIncomingBody(2, true), /mission/i);
});
