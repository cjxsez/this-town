import { test } from "node:test";
import assert from "node:assert/strict";
import type { BufferGeometry } from "three";
import { CONFIG } from "../src/config";
import { hexToRgb, IdAllocator } from "../src/scene/builder";
import { ANIMALS, animalGeometry, figureGeometry, glassesGeometry, SPOTS, spotGeometry } from "../src/studio/models";
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

test("there is a badge animal for each of the app's eight", () => {
  assert.deepEqual([...ANIMALS].sort(), ["bear", "cat", "deer", "duck", "fox", "frog", "owl", "rabbit"]);
});

for (const animal of ANIMALS) {
  test(`${animal}: a paper-white head with ink eyes, about one unit across`, () => {
    const g = animalGeometry(animal, C, new IdAllocator());
    const { min, max } = box(g);
    assert.ok(g.getAttribute("position").count > 300);
    assert.ok(max.x - min.x > 0.8 && max.x - min.x < 2.2, `width ${max.x - min.x}`);
    assert.ok(Math.abs(max.x + min.x) < 0.05, "symmetrical left to right");
    assert.ok(hasColor(g, C.paper) && hasColor(g, C.ink));
  });
}

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

test("each meeting spot is a small scene standing on a platform", () => {
  assert.deepEqual([...SPOTS], ["system-map", "third-bench", "comm-ave-stairs"]);
  for (const spot of SPOTS) {
    const g = spotGeometry(spot, CONFIG, new IdAllocator());
    const { min, max } = box(g);
    assert.ok(min.y >= -1e-6 && max.y > 1.5, spot);
    assert.ok(hasColor(g, C.yellow), `${spot} has the yellow platform edge`);
  }
});

test("the shot list covers every art slot in the phone app, once each", () => {
  const ids = SHOTS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  const wanted = [
    "hero-art",
    "ride-rider",
    "glasses-art",
    "memory-photo",
    "memory-m-jo",
    "memory-m-dev",
    "memory-m-ravi",
    ...SPOTS.map((s) => `meet-spot-kenmore-${s}`),
    ...ANIMALS.map((a) => `animal-${a}`),
  ];
  for (const id of wanted) assert.ok(ids.includes(id), id);
  for (const shot of SHOTS) assert.ok(shot.width > 0 && shot.height > 0 && shot.scale >= 2, shot.id);
});
