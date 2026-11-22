import { test } from "node:test";
import assert from "node:assert/strict";
import { Material } from "three";
import { CONFIG } from "../src/config";
import { platformClock } from "../src/core/platformClock";
import { hexToRgb, IdAllocator } from "../src/scene/builder";
import { buildWorld } from "../src/scene/world";

const timing = { legSeconds: 9, dwellSeconds: 3.6, leadInSeconds: 4, holdAt: 0.55 };

test("loop: the first train pulls in a few seconds after the scene appears, then they keep coming", () => {
  assert.equal(platformClock({ mode: "loop", elapsed: 0, reducedMotion: false }, timing), -4);
  assert.equal(platformClock({ mode: "loop", elapsed: 4, reducedMotion: false }, timing), 0);
  assert.equal(platformClock({ mode: "loop", elapsed: 30, reducedMotion: false }, timing), 26);
});

test("arrive: the train waits out of sight, rolls in for the last seconds, and stays", () => {
  const at = (untilArrival: number) => platformClock({ mode: "arrive", elapsed: 99, untilArrival, reducedMotion: false }, timing);
  assert.ok(Math.abs(at(120) - -9 * 0.55) < 1e-9, "far off: held on the far side of the loop");
  assert.equal(at(2), -2);
  assert.equal(at(0), 0);
  assert.equal(at(-1), 1);
  assert.equal(at(-500), 1.8, "long after: still standing at the platform");
});

test("arrive without a time behaves as arriving now", () => {
  assert.equal(platformClock({ mode: "arrive", elapsed: 0.5, reducedMotion: false }, timing), -3.5);
});

test("reduced motion: the train simply stands at the platform", () => {
  assert.equal(platformClock({ mode: "loop", elapsed: 7, reducedMotion: true }, timing), 1.8);
  assert.equal(platformClock({ mode: "arrive", elapsed: 7, untilArrival: 40, reducedMotion: true }, timing), 1.8);
});

const materials = { world: new Material(), hud: new Material(), foam: new Material(), dropShadow: new Material() };
const hasColor = (g: ReturnType<typeof buildWorld>["cars"][number]["geometry"], hex: string) => {
  const [r, gr, b] = hexToRgb(hex);
  const c = g.getAttribute("color");
  for (let i = 0; i < c.count; i++) {
    if (Math.abs(c.getX(i) - r) < 1e-6 && Math.abs(c.getY(i) - gr) < 1e-6 && Math.abs(c.getZ(i) - b) < 1e-6) return true;
  }
  return false;
};

test("the trolley can wear another line's colour", () => {
  const red = CONFIG.lineColors[1];
  const world = buildWorld(CONFIG, CONFIG.seas.Day, new IdAllocator(), materials, { trainStripe: red });
  assert.ok(hasColor(world.cars[0]!.geometry, red));
  assert.ok(!hasColor(world.cars[0]!.geometry, CONFIG.lineColors[0]));
});

test("with one stop on its timetable, the train goes right round and stops in front of you", () => {
  const stop = CONFIG.world.stations.anglesDeg[0];
  const config = { ...CONFIG, train: { ...CONFIG.train, startSeconds: 0, legSeconds: 9, dwellSeconds: 3.6 } } as unknown as typeof CONFIG;
  const world = buildWorld(config, CONFIG.seas.Day, new IdAllocator(), materials, { stopsDeg: [stop] });
  const middle = () => world.cars.reduce((sum, car) => sum + (Math.atan2(car.position.z, car.position.x) * 180) / Math.PI, 0) / world.cars.length;
  world.update(1);
  assert.ok(Math.abs(middle() - stop) < 1e-6, "standing at the stop");
  world.update(3.6 + 4.5);
  // Angular distance from the stop: 180 means directly across the island.
  assert.ok(Math.abs(((middle() - stop + 540) % 360) - 180) > 179, "half way round, on the far side");
  world.update(12.6 + 1);
  assert.ok(Math.abs(middle() - stop) < 1e-6, "back again one lap later");
});
