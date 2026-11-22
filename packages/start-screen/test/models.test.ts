import { test } from "node:test";
import assert from "node:assert/strict";
import type { BufferGeometry } from "three";
import { CONFIG } from "../src/config";
import { hexToRgb, IdAllocator } from "../src/scene/builder";
import { figureGeometry, glassesGeometry, handPosition } from "../src/studio/models";
import { SHOTS } from "../src/studio/shots";

const C = CONFIG.colors;
const box = (g: BufferGeometry) => {
  g.computeBoundingBox();
  return g.boundingBox!;
};
const hasColor = (g: BufferGeometry, hex: string) => {
  const [r, gr, b] = hexToRgb(hex);
  const c = g.getAttribute("color");
  for (let i = 0; i < c.count; i++) {
    if (Math.abs(c.getX(i) - r) < 1e-6 && Math.abs(c.getY(i) - gr) < 1e-6 && Math.abs(c.getZ(i) - b) < 1e-6) return true;
  }
  return false;
};

test("a rider figure stands one unit tall on the ground, in its shirt and badge colours", () => {
  const g = figureGeometry({ shirt: C.orange, hair: C.inkSoft, badge: C.yellow }, C, new IdAllocator());
  const { min, max } = box(g);
  assert.ok(Math.abs(min.y) < 1e-6);
  assert.ok(max.y > 0.95 && max.y < 1.1, `height ${max.y}`);
  assert.ok(hasColor(g, C.orange) && hasColor(g, C.yellow) && hasColor(g, C.ink));
});

const look = { shirt: C.orange, hair: C.inkSoft, badge: C.yellow };
const highest = (g: BufferGeometry) => box(g).max.y;

test("a rider can raise their arms: hands go above the shoulders, and still within 1.15 units", () => {
  const down = figureGeometry(look, C, new IdAllocator());
  const up = figureGeometry(look, C, new IdAllocator(), { arms: [155, 155] });
  assert.ok(highest(up) > highest(down) - 1e-6);
  assert.ok(highest(up) <= 1.15, `height ${highest(up)}`);
  for (const side of [-1, 1] as const) {
    const hand = handPosition(side, 155);
    assert.ok(hand.y > 0.8, `hand ${side} at ${hand.y}`);
    assert.ok(Math.sign(hand.x) === side, "a raised hand stays on its own side");
  }
});

test("arms at rest hang by the sides, a little out from the body", () => {
  for (const side of [-1, 1] as const) {
    const hand = handPosition(side, 12);
    assert.ok(hand.y < 0.4 && hand.y > 0.2, `hand ${side} at ${hand.y}`);
    assert.ok(Math.abs(hand.x) > 0.2 && Math.abs(hand.x) < 0.33);
  }
});

test("each arm is posed on its own: one up for a high five, one down", () => {
  const g = figureGeometry(look, C, new IdAllocator(), { arms: [10, 150] });
  const p = g.getAttribute("position");
  let topLeft = -Infinity;
  let topRight = -Infinity;
  for (let i = 0; i < p.count; i++) {
    if (p.getX(i) < -0.26) topLeft = Math.max(topLeft, p.getY(i));
    if (p.getX(i) > 0.26) topRight = Math.max(topRight, p.getY(i));
  }
  assert.ok(topRight > 0.8 && topLeft < 0.6, `left ${topLeft}, right ${topRight}`);
});

test("the glasses are wider than tall and have dark frames", () => {
  const g = glassesGeometry(C, new IdAllocator());
  const { min, max } = box(g);
  assert.ok(max.x - min.x > (max.y - min.y) * 2);
  assert.ok(hasColor(g, C.inkDeep));
});

test("the shot list covers every picture the phone app uses, once each", () => {
  const ids = SHOTS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  const friends = ["green", "blue", "pink", "yellow", "purple"];
  // ArtSlot ids (landing, riding, glasses), the sprites the flat fallback scenes use,
  // and the celebration pieces for the stamp and recap screens (a friend per pair colour).
  const wanted = [
    "hero-art",
    "ride-rider",
    "glasses-art",
    "sprite-tree",
    "sprite-house-pink",
    "sprite-house-red",
    ...["green", "red", "orange", "blue"].map((line) => `sprite-trolley-${line}`),
    "cheer-you",
    ...friends.map((c) => `cheer-friend-${c}`),
    "highfive-you",
    ...friends.map((c) => `highfive-friend-${c}`),
    "stage-platform",
    "recap-backdrop",
  ];
  for (const id of wanted) assert.ok(ids.includes(id), id);
  for (const shot of SHOTS) assert.ok(shot.width > 0 && shot.height > 0 && shot.scale >= 2, shot.id);
});
