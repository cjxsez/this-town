import { test } from "node:test";
import assert from "node:assert/strict";
import { Material } from "three";
import { CONFIG } from "../src/config";
import { IdAllocator } from "../src/scene/builder";
import { buildWorld } from "../src/scene/world";

const materials = { world: new Material(), hud: new Material(), foam: new Material(), dropShadow: new Material() };
const build = () => buildWorld(CONFIG, CONFIG.seas.Day, new IdAllocator(), materials);
const world = build();
const W = CONFIG.world;
const T = CONFIG.train;
const deg = (r: number) => (r * 180) / Math.PI;
const angleOf = (o: { position: { x: number; z: number } }) => deg(Math.atan2(o.position.z, o.position.x));
const turnsApart = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

test("the train has the configured number of cars", () => {
  assert.equal(world.cars.length, T.cars);
});

test("every car rides the rails at every moment", () => {
  for (const seconds of [0, 1.3, 4.7, 12, 99.9]) {
    world.update(seconds);
    for (const car of world.cars) {
      assert.ok(Math.abs(Math.hypot(car.position.x, car.position.z) - W.track.radius) < 1e-6);
      assert.ok(car.position.y > W.grass.top);
    }
  }
});

test("cars follow each other one car length plus the gap apart, lead car in front", () => {
  world.update(3.21);
  const step = deg((T.carLength + T.carGap) / W.track.radius);
  const [lead, second] = world.cars;
  assert.ok(Math.abs(((angleOf(lead!) - angleOf(second!) + 360) % 360) - step) < 1e-6);
});

test("the train stops with its middle at a station", () => {
  // startSeconds into the timetable at t = 0; rewind to the start of a wait.
  world.update(-T.startSeconds + 0.5 * T.dwellSeconds);
  const middle = world.cars.reduce((sum, car) => sum + angleOf(car), 0) / world.cars.length;
  assert.ok(turnsApart(middle, W.stations.anglesDeg[0]) < 1e-6, `middle at ${middle}`);
});

test("a car points along the track", () => {
  world.update(2);
  const car = world.cars[0]!;
  car.updateMatrixWorld(true);
  const e = car.matrixWorld.elements;
  // Local +X (the car's nose) in world space should be the direction of travel.
  const a = Math.atan2(car.position.z, car.position.x);
  assert.ok(Math.abs(e[0]! - -Math.sin(a)) < 1e-6 && Math.abs(e[2]! - Math.cos(a)) < 1e-6);
});

test("nothing on the island hangs below the water or far past the shore", () => {
  const p = world.island.geometry.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    assert.ok(p.getY(i) >= -1e-6, `y ${p.getY(i)}`);
    assert.ok(Math.hypot(p.getX(i), p.getZ(i)) <= W.shore.radius * 1.12);
  }
});

test("every piece has an id, and there are many separate pieces to ink", () => {
  const ids = new Set<number>();
  const oid = world.island.geometry.getAttribute("oid");
  for (let i = 0; i < oid.count; i++) ids.add(oid.getX(i));
  assert.ok(!ids.has(0));
  assert.ok(ids.size >= W.trees.count + W.rowhouses.count + W.stations.anglesDeg.length + 5, `${ids.size} ids`);
  const carIds = world.cars.map((car) => car.geometry.getAttribute("oid").getX(0));
  assert.equal(new Set(carIds).size, T.cars);
  for (const id of carIds) assert.ok(!ids.has(id));
});

test("trees keep clear of each other, the track, the pond and the platforms", () => {
  assert.equal(world.trees.length, W.trees.count);
  const half = W.track.width / 2;
  for (const [i, a] of world.trees.entries()) {
    const r = Math.hypot(a.x, a.z);
    assert.ok(Math.abs(r - W.track.radius) > half + a.radius * 0.5, `tree ${i} is on the track`);
    assert.ok(Math.hypot(a.x - W.pond.x, a.z - W.pond.z) > W.pond.radius, `tree ${i} is in the pond`);
    for (const stop of W.stations.anglesDeg) {
      const near = turnsApart(deg(Math.atan2(a.z, a.x)), stop) < 14;
      assert.ok(!(near && r > W.track.radius), `tree ${i} is on a platform`);
    }
    for (const b of world.trees.slice(i + 1)) {
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= W.trees.spacing - 1e-9);
    }
  }
});

test("the same seed builds the same island", () => {
  const again = build();
  assert.deepEqual(
    Array.from(again.island.geometry.getAttribute("position").array as Float32Array).slice(0, 3000),
    Array.from(world.island.geometry.getAttribute("position").array as Float32Array).slice(0, 3000),
  );
});

test("the island and train cast shadows; the foam does not and stays on the water", () => {
  const casts = (o: { layers: { mask: number } }) => (o.layers.mask & 2) !== 0;
  assert.ok(casts(world.island));
  for (const car of world.cars) assert.ok(casts(car));
  let foamMeshes = 0;
  world.foam.traverse((o) => {
    if ("isMesh" in o) {
      foamMeshes++;
      assert.ok(!casts(o));
    }
  });
  assert.ok(foamMeshes >= 2);
  assert.ok(world.foam.parent !== world.group && world.group.children.includes(world.island));
});

test("the foam breathes in and out a little", () => {
  world.update(W.foamRing.breatheSeconds / 4);
  assert.ok(Math.abs(world.foam.scale.x - (1 + W.foamRing.breathe)) < 1e-6);
  world.update(0);
  assert.ok(Math.abs(world.foam.scale.x - 1) < 1e-6);
});
