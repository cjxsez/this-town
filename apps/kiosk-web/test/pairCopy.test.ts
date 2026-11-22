import test from "node:test";
import assert from "node:assert/strict";
import { howItWorksSteps, pairIncomingBody } from "../src/lib/pairCopy";

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

test("How it works keeps the mission stamp line when missions are on", () => {
  const steps = howItWorksSteps(false);
  assert.equal(steps[2], "Meet at the kiosk, do the mission, both tap for a stamp.");
  assert.match(steps.join(" "), /mission/i);
});

test("How it works is games-aware and never says mission", () => {
  const steps = howItWorksSteps(true);
  assert.match(steps[2], /phones or glasses/i);
  assert.doesNotMatch(steps.join(" "), /mission/i);
});
