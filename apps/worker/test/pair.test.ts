import test from "node:test";
import assert from "node:assert/strict";
import { busyKiosks, carDelta, greedyPairs, meetingPoint } from "../src/matching/pair";
import type { RoomPair } from "../src/rooms/state";
import { rider, room } from "./fixtures";

const GATE = { minSharedTags: 1, ignoreMetRecently: false };
const ORDER = ["1", "2", "3", "4"]; // front first

const busyAt = (...cars: string[]) =>
  Object.fromEntries(cars.map((car, i) => [`m${i}`, { meetAtCar: car } as RoomPair]));

test("carDelta is positive when the kiosk is toward the front", () => {
  assert.equal(carDelta(ORDER, "3", "1"), 2);
  assert.equal(carDelta(ORDER, "1", "3"), -2);
  assert.equal(carDelta(ORDER, "2", "2"), 0);
  assert.equal(carDelta(ORDER, "2", "9"), 0); // unknown car: no direction rather than a wrong one
});

test("riders in the same car meet there and nobody walks", () => {
  const m = meetingPoint(rider("a", { car: "2" }), rider("b", { car: "2" }), room());
  assert.deepEqual(m, { meetAtCar: "2", walker: null });
});

test("the rider with more stops left stays put and the other walks", () => {
  const a = rider("a", { car: "1", destinationStop: "E" });
  const b = rider("b", { car: "3", destinationStop: "C" });
  assert.deepEqual(meetingPoint(a, b, room()), { meetAtCar: "1", walker: "b" });
  assert.deepEqual(meetingPoint(b, a, room()), { meetAtCar: "1", walker: "b" });
});

test("on a tie, whoever checked in last stays (they just sat down)", () => {
  const early = rider("early", { car: "1", checkedInAt: 10 });
  const late = rider("late", { car: "3", checkedInAt: 20 });
  assert.deepEqual(meetingPoint(early, late, room()), { meetAtCar: "3", walker: "early" });
});

test("if the stayer's kiosk is busy they meet at the walker's kiosk instead", () => {
  const a = rider("a", { car: "1", destinationStop: "E" });
  const b = rider("b", { car: "3", destinationStop: "C" });
  assert.deepEqual(meetingPoint(a, b, room({ pairs: busyAt("1") })), { meetAtCar: "3", walker: "a" });
});

test("busyKiosks lists every car hosting a pair", () => {
  assert.deepEqual([...busyKiosks(room({ pairs: busyAt("1", "3") }))].sort(), ["1", "3"]);
});

test("greedy pairing takes the closest pair first and pairs each rider once", () => {
  const a = rider("a", { car: "1" });
  const b = rider("b", { car: "2" }); // next to a
  const c = rider("c", { car: "4" }); // far from both
  const pairs = greedyPairs([a, b, c], room(), GATE);
  assert.equal(pairs.length, 1);
  assert.deepEqual([pairs[0]!.a.userId, pairs[0]!.b.userId].sort(), ["a", "b"]);
});

test("two pairs never share a kiosk in the same round", () => {
  const riders = [rider("a", { car: "1" }), rider("b", { car: "1" }), rider("c", { car: "1" }), rider("d", { car: "1" })];
  const pairs = greedyPairs(riders, room(), GATE);
  assert.equal(pairs.length, 1, "four riders in car 1 share one kiosk, so only one pair can meet now");
});

test("riders that fail the gate are not paired", () => {
  const a = rider("a", { car: "1", interests: ["coffee"] });
  const b = rider("b", { car: "2", interests: ["ramen"] });
  assert.deepEqual(greedyPairs([a, b], room(), GATE), []);
});

test("a pair whose both kiosks are busy waits for one to free up", () => {
  const a = rider("a", { car: "1" });
  const b = rider("b", { car: "2" });
  assert.deepEqual(greedyPairs([a, b], room({ pairs: busyAt("1", "2") }), GATE), []);
});

test("each proposed pair carries its shared tags and who walks", () => {
  const a = rider("a", { car: "1", interests: ["coffee", "anime"], destinationStop: "E" });
  const b = rider("b", { car: "3", interests: ["anime"], destinationStop: "C" });
  const [p] = greedyPairs([a, b], room(), GATE);
  assert.deepEqual(p!.sharedTags, ["anime"]);
  assert.equal(p!.meetAtCar, "1");
  assert.equal(p!.walker, "b");
});
