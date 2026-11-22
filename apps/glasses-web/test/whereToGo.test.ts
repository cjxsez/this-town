import test from "node:test";
import assert from "node:assert/strict";
import type { MatchFound } from "../src/lib/socket";
import { whereToGo } from "../src/lib/whereToGo";

function match(patch: Partial<MatchFound> = {}): MatchFound {
  return {
    type: "match.found",
    matchId: "m1",
    partner: { firstName: "Maya", color: "orange", sharedTags: ["ramen"] },
    why: "You both like ramen",
    meetAtCar: "1413",
    carDelta: 1,
    youWalk: true,
    ...patch,
  };
}

test("same car when carDelta is 0 and meetAtCar matches current car", () => {
  assert.equal(whereToGo(match({ carDelta: 0, meetAtCar: "1412", youWalk: true }), "1412"), "Same car. Head to the kiosk");
});

test("unknown carOrder: carDelta 0 but meetAtCar differs says Go to car", () => {
  assert.equal(whereToGo(match({ carDelta: 0, meetAtCar: "9901", youWalk: true }), "1412"), "Go to car 9901");
  assert.equal(whereToGo(match({ carDelta: 0, meetAtCar: "9901", youWalk: false }), "1412"), "Go to car 9901");
});

test("directed walk uses forward/back copy when carDelta is non-zero", () => {
  assert.equal(whereToGo(match({ carDelta: 1, youWalk: true }), "1412"), "Kiosk 1 car forward");
  assert.equal(whereToGo(match({ carDelta: -2, youWalk: true }), "1412"), "Kiosk 2 cars back");
});
