import { test } from "node:test";
import assert from "node:assert/strict";
import { mulberry32 } from "../src/core/rng";
import { trainCenterDeg } from "../src/core/train";

const timetable = { stopsDeg: [30, 150, 270], legSeconds: 4, dwellSeconds: 1, startSeconds: 0 };
const period = 3 * (4 + 1);

test("the train waits at the first stop, then at each stop in turn", () => {
  assert.equal(trainCenterDeg(0, timetable), 30);
  assert.equal(trainCenterDeg(0.99, timetable), 30);
  assert.ok(Math.abs(trainCenterDeg(5, timetable) - 150) < 1e-9);
  assert.ok(Math.abs(trainCenterDeg(5.5, timetable) - 150) < 1e-9);
  assert.ok(Math.abs(trainCenterDeg(10.2, timetable) - 270) < 1e-9);
});

test("halfway through a leg it is halfway between stops", () => {
  assert.ok(Math.abs(trainCenterDeg(1 + 2, timetable) - 90) < 1e-9);
});

test("it pulls out gently", () => {
  const justLeft = trainCenterDeg(1.4, timetable) - 30;
  assert.ok(justLeft > 0 && justLeft < 120 * 0.1 * 0.5, `moved ${justLeft} deg in the first tenth of the leg`);
});

test("one full timetable later it has gone once round", () => {
  for (const t of [0, 0.7, 3.3, 9]) {
    assert.ok(Math.abs(trainCenterDeg(t + period, timetable) - trainCenterDeg(t, timetable) - 360) < 1e-9);
  }
});

test("it never runs backwards", () => {
  let last = -Infinity;
  for (let t = 0; t < period * 2; t += 0.05) {
    const a = trainCenterDeg(t, timetable);
    assert.ok(a >= last - 1e-9);
    last = a;
  }
});

test("startSeconds shifts the timetable", () => {
  assert.equal(trainCenterDeg(0, { ...timetable, startSeconds: 3 }), trainCenterDeg(3, timetable));
});

test("mulberry32 is repeatable, seed-dependent, and stays in 0..1", () => {
  const a = mulberry32(11);
  const b = mulberry32(11);
  const c = mulberry32(12);
  const as = Array.from({ length: 50 }, a);
  assert.deepEqual(as, Array.from({ length: 50 }, b));
  assert.notDeepEqual(as, Array.from({ length: 50 }, c));
  assert.ok(as.every((x) => x >= 0 && x < 1));
});
