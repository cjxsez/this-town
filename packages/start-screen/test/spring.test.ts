import { test } from "node:test";
import assert from "node:assert/strict";
import { Spring } from "../src/core/spring";

const run = (s: Spring, seconds: number, fps = 60) => {
  const seen: number[] = [];
  for (let i = 0; i < seconds * fps; i++) seen.push(s.step(1 / fps));
  return seen;
};

test("settles on its target", () => {
  const s = new Spring({ stiffness: 210, damping: 13 });
  s.target = 1;
  run(s, 3);
  assert.ok(Math.abs(s.value - 1) < 1e-3, `value ${s.value}`);
  assert.ok(Math.abs(s.velocity) < 1e-2);
});

test("a lightly damped spring overshoots, a heavily damped one does not", () => {
  const bouncy = new Spring({ stiffness: 210, damping: 13 });
  bouncy.target = 1;
  assert.ok(Math.max(...run(bouncy, 2)) > 1.05);
  const firm = new Spring({ stiffness: 200, damping: 40 });
  firm.target = 1;
  assert.ok(Math.max(...run(firm, 2)) <= 1.0001);
});

test("a zero-length step changes nothing", () => {
  const s = new Spring({ stiffness: 210, damping: 13, value: 0.3 });
  s.target = 1;
  s.step(0);
  assert.equal(s.value, 0.3);
  assert.equal(s.velocity, 0);
});

test("one very long step stays finite and near the target", () => {
  const s = new Spring({ stiffness: 620, damping: 30 });
  s.target = 1;
  s.step(1.5);
  assert.ok(Number.isFinite(s.value));
  assert.ok(Math.abs(s.value - 1) < 0.05, `value ${s.value}`);
});

test("the frame rate does not change where it ends up", () => {
  const a = new Spring({ stiffness: 85, damping: 9.5 });
  const b = new Spring({ stiffness: 85, damping: 9.5 });
  a.target = b.target = 6.28;
  run(a, 0.5, 30);
  run(b, 0.5, 120);
  assert.ok(Math.abs(a.value - b.value) < 0.05, `${a.value} vs ${b.value}`);
});

test("snap jumps to a value and stops", () => {
  const s = new Spring({ stiffness: 85, damping: 9.5 });
  s.target = 5;
  run(s, 0.1);
  s.snap(2);
  assert.equal(s.value, 2);
  assert.equal(s.target, 2);
  assert.equal(s.velocity, 0);
});
