import test from "node:test";
import assert from "node:assert/strict";
import { buildPool, inPool, passesGate, remainingSegments, sharedTags } from "../src/matching/pool";
import { pairKey } from "../src/lib/ids";
import { rider, room, withRiders } from "./fixtures";

const GATE = { minSharedTags: 1, ignoreMetRecently: false };
const NOW = 1_000_000;

test("remaining segments count stops from here to the rider's destination", () => {
  const s = room(); // current stop A (index 0)
  assert.equal(remainingSegments(rider("a", { destinationStop: "B" }), s), 1);
  assert.equal(remainingSegments(rider("a", { destinationStop: "E" }), s), 4);
  assert.equal(remainingSegments(rider("a", { destinationStop: "nowhere" }), s), 0);
});

test("a fresh rider with stops left is in the pool", () => {
  assert.equal(inPool(rider("a"), room(), NOW), true);
});

test("ghosts, riders already paired and riders cooling down after Not now are out", () => {
  const s = room();
  assert.equal(inPool(rider("a", { ghost: true }), s, NOW), false);
  assert.equal(inPool(rider("a", { pairId: "mat_1" }), s, NOW), false);
  assert.equal(inPool(rider("a", { notNowUntil: NOW + 1 }), s, NOW), false);
  assert.equal(inPool(rider("a", { notNowUntil: NOW - 1 }), s, NOW), true);
});

test("after the games stamp a rider rests, even in games-only where stops don't count", () => {
  const s = room();
  assert.equal(inPool(rider("a", { restUntil: NOW + 1 }), s, NOW, true), false);
  assert.equal(inPool(rider("a", { restUntil: NOW + 1 }), s, NOW), false);
  assert.equal(inPool(rider("a", { restUntil: NOW - 1 }), s, NOW, true), true);
});

test("after a mission a rider waits for the next segment", () => {
  const s = room({ nextStopIdx: 1 });
  assert.equal(inPool(rider("a", { eligibleFromStopIdx: 2 }), s, NOW), false);
  assert.equal(inPool(rider("a", { eligibleFromStopIdx: 1 }), s, NOW), true);
});

test("nobody is matched once the trip has no next stop", () => {
  assert.equal(inPool(rider("a"), room({ nextStopIdx: null }), NOW), false);
});

test("a rider whose stop is the one we are at has no segments left", () => {
  assert.equal(inPool(rider("a", { destinationStop: "A" }), room(), NOW), false);
});

test("with stops ignored (GAMES_ONLY) a rider past their stop or waiting for a segment still matches", () => {
  const s = room();
  assert.equal(inPool(rider("a", { destinationStop: "A" }), s, NOW, true), true);
  assert.equal(inPool(rider("a", { eligibleFromStopIdx: 2 }), s, NOW, true), true);
  assert.equal(inPool(rider("a", { ghost: true }), s, NOW, true), false);
  assert.equal(inPool(rider("a", { pairId: "mat_1" }), s, NOW, true), false);
});

test("buildPool keeps only the riders that can be matched", () => {
  const s = withRiders(room(), rider("a"), rider("b", { ghost: true }), rider("c"));
  assert.deepEqual(buildPool(s, NOW).map((r) => r.userId).sort(), ["a", "c"]);
});

test("shared tags are the interests both riders picked, in the first rider's order", () => {
  const a = rider("a", { interests: ["coffee", "ramen", "anime"] });
  const b = rider("b", { interests: ["anime", "coffee"] });
  assert.deepEqual(sharedTags(a, b), ["coffee", "anime"]);
});

test("the gate needs enough shared interests", () => {
  const a = rider("a", { interests: ["coffee"] });
  const b = rider("b", { interests: ["ramen"] });
  assert.equal(passesGate(a, b, room(), GATE), false);
  assert.equal(passesGate(a, rider("c", { interests: ["coffee"] }), room(), GATE), true);
});

test("the gate never pairs a rider with themself", () => {
  const a = rider("a");
  assert.equal(passesGate(a, a, room(), GATE), false);
});

test("a block in either direction keeps two riders apart", () => {
  assert.equal(passesGate(rider("a", { blocked: ["b"] }), rider("b"), room(), GATE), false);
  assert.equal(passesGate(rider("a"), rider("b", { blocked: ["a"] }), room(), GATE), false);
});

test("riders met in the last 7 days are skipped, unless the demo ignores it", () => {
  const a = rider("a", { metRecently: ["b"] });
  const b = rider("b");
  assert.equal(passesGate(a, b, room(), GATE), false);
  assert.equal(passesGate(b, a, room(), GATE), false);
  assert.equal(passesGate(a, b, room(), { ...GATE, ignoreMetRecently: true }), true);
});

test("a pair where one side said Not now this trip is never offered again", () => {
  const s = room({ declinedPairs: [pairKey("a", "b")] });
  assert.equal(passesGate(rider("a"), rider("b"), s, GATE), false);
  assert.equal(passesGate(rider("b"), rider("a"), s, GATE), false);
});
