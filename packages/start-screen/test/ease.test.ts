import { test } from "node:test";
import assert from "node:assert/strict";
import { EASE } from "../src/config";
import { clamp01, cubicBezier, mix } from "../src/core/ease";

test("every curve starts at 0 and ends at 1", () => {
  for (const curve of Object.values(EASE)) {
    const f = cubicBezier(curve);
    assert.ok(Math.abs(f(0)) < 1e-6);
    assert.ok(Math.abs(f(1) - 1) < 1e-6);
  }
});

test("a straight curve returns its input", () => {
  const f = cubicBezier([0, 0, 1, 1]);
  for (const x of [0.1, 0.33, 0.5, 0.9]) assert.ok(Math.abs(f(x) - x) < 1e-4, `f(${x}) = ${f(x)}`);
});

test("matches CSS cubic-bezier(.25,.1,.25,1) at the midpoint", () => {
  // The CSS "ease" curve is 0.8024 at x = 0.5.
  assert.ok(Math.abs(cubicBezier([0.25, 0.1, 0.25, 1])(0.5) - 0.8024) < 1e-3);
});

test("the arrive curve overshoots past 1 before settling", () => {
  const f = cubicBezier(EASE.arrive);
  let peak = 0;
  for (let x = 0; x <= 1; x += 0.01) peak = Math.max(peak, f(x));
  assert.ok(peak > 1.02, `peak ${peak}`);
});

test("the leave curve starts slowly", () => {
  assert.ok(cubicBezier(EASE.leave)(0.5) < 0.3);
});

test("input outside 0..1 is clamped", () => {
  const f = cubicBezier(EASE.sheet);
  assert.equal(f(-3), 0);
  assert.equal(f(7), 1);
});

test("clamp01 and mix", () => {
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01(0.4), 0.4);
  assert.equal(mix(10, 20, 0.25), 12.5);
});
