import { test } from "node:test";
import assert from "node:assert/strict";
import type { BufferGeometry } from "three";
import { CONFIG } from "../src/config";
import { hexToRgb, IdAllocator } from "../src/scene/builder";
import { figureGeometry, glassesGeometry } from "../src/studio/models";
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

test("the glasses are wider than tall and have dark frames", () => {
  const g = glassesGeometry(C, new IdAllocator());
  const { min, max } = box(g);
  assert.ok(max.x - min.x > (max.y - min.y) * 2);
  assert.ok(hasColor(g, C.inkDeep));
});

test("the shot list covers every picture the phone app uses, once each", () => {
  const ids = SHOTS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  // ArtSlot ids (landing, riding, glasses) and the sprites the flat fallback scenes use.
  const wanted = [
    "hero-art",
    "ride-rider",
    "glasses-art",
    "sprite-tree",
    "sprite-house-pink",
    "sprite-house-red",
    ...["green", "red", "orange", "blue"].map((line) => `sprite-trolley-${line}`),
  ];
  for (const id of wanted) assert.ok(ids.includes(id), id);
  for (const shot of SHOTS) assert.ok(shot.width > 0 && shot.height > 0 && shot.scale >= 2, shot.id);
});
