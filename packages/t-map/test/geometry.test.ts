import test from "node:test";
import assert from "node:assert/strict";
import { along, between, roundedPath, samplePath, type Pt } from "../src/geometry";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);

test("a two-point path is one straight segment", () => {
  assert.equal(roundedPath([[0, 0], [10, 0]], 5), "M0 0L10 0");
});

test("a right angle is rounded with an arc that starts and ends one radius from the corner", () => {
  assert.equal(roundedPath([[0, 0], [10, 0], [10, 10]], 4), "M0 0L6 0A4 4 0 0 1 10 4L10 10");
});

test("the arc turns the other way for a left turn", () => {
  assert.equal(roundedPath([[0, 0], [10, 0], [10, -10]], 4), "M0 0L6 0A4 4 0 0 0 10 -4L10 -10");
});

test("a 45 degree bend uses the tangent length r * tan(22.5 deg)", () => {
  const t = 10 * Math.tan(Math.PI / 8);
  const pts = samplePath([[0, 0], [100, 0], [200, 100]], 10, 1);
  // every sampled point stays within the corner's tangent points or on the two segments
  const onFirst = pts.filter(([, y]) => y === 0).map(([x]) => x);
  near(Math.max(...onFirst), 100 - t, 0.5);
});

test("a radius too big for its segments is shrunk to fit", () => {
  assert.equal(roundedPath([[0, 0], [4, 0], [4, 4]], 50), "M0 0A4 4 0 0 1 4 4");
});

test("each corner can have its own radius, and 0 keeps it sharp", () => {
  assert.equal(roundedPath([[0, 0], [10, 0], [10, 10], [20, 10]], [0, 2]), "M0 0L10 0L10 8A2 2 0 0 0 12 10L20 10");
});

test("samplePath follows the arc, never cutting the corner straight", () => {
  const pts = samplePath([[0, 0], [10, 0], [10, 10]], 4, 0.5);
  for (const [x, y] of pts) {
    if (x > 6 && y < 4) near(Math.hypot(x - 6, y - 4), 4, 1e-6);
  }
  assert.deepEqual(pts[0], [0, 0]);
  assert.deepEqual(pts[pts.length - 1], [10, 10]);
});

test("between spaces n points evenly, ends excluded", () => {
  assert.deepEqual(between([0, 0], [30, 60], 2), [[10, 20], [20, 40]]);
});

test("along walks a polyline by distance", () => {
  const p: Pt[] = [[0, 0], [10, 0], [10, 10]];
  assert.deepEqual(along(p, 5), [5, 0]);
  assert.deepEqual(along(p, 15), [10, 5]);
  assert.deepEqual(along(p, 99), [10, 10]);
});
