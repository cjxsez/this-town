import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../src/config";
import { buttonPose, cameraPose, hudUnitsPerPx, islandPose, tilePose } from "../src/scene/pose";

const rad = Math.PI / 180;
const rest = { pitch: -15 * rad, yaw: 2 * rad, roll: -1 * rad };
const still = { rest, intro: 1, pop: 1, outro: 0, tiltX: 0, tiltY: 0, lift: 0, flap: 0 };

test("a tile at rest sits exactly on its slot in its resting pose", () => {
  assert.deepEqual(tilePose(still, CONFIG), { dy: 0, dz: 0, rotX: rest.pitch, rotY: rest.yaw, rotZ: rest.roll, scale: 1 });
});

test("a tile starts the intro invisible, flipped over and above its slot", () => {
  const p = tilePose({ ...still, intro: 0, pop: 0 }, CONFIG);
  assert.equal(p.scale, 0);
  assert.ok(Math.abs(p.rotX - (rest.pitch + CONFIG.intro.tileFlipFromDeg * rad)) < 1e-9);
  assert.ok(Math.abs(p.dy - CONFIG.intro.tileDropFrom) < 1e-9);
});

test("hovering lifts and leans a tile; tapping spins it", () => {
  const p = tilePose({ ...still, tiltX: 1, tiltY: -0.5, lift: 1, flap: Math.PI }, CONFIG);
  assert.ok(Math.abs(p.scale - (1 + CONFIG.interaction.tileLiftScale)) < 1e-9);
  assert.ok(Math.abs(p.rotX - (rest.pitch + CONFIG.interaction.tileTiltDeg * rad + Math.PI)) < 1e-9);
  assert.ok(Math.abs(p.rotY - (rest.yaw - 0.5 * CONFIG.interaction.tileTiltDeg * rad)) < 1e-9);
  assert.ok(p.dz > 0);
});

test("a tile is gone by the end of the outro", () => {
  const p = tilePose({ ...still, outro: 1 }, CONFIG);
  assert.equal(p.scale, 0);
  assert.ok(Math.abs(p.rotX - (rest.pitch + CONFIG.outro.tileFlipToDeg * rad)) < 1e-9);
});

test("the button pops in, sinks when pressed, and drops away after BEGIN", () => {
  const base = { intro: 1, outro: 0, hover: 0, press: 0 };
  const atRest = buttonPose(base, CONFIG);
  assert.deepEqual(atRest, { dy: 0, dz: 0, rotX: CONFIG.hud.button.restPitchDeg * rad, rotZ: CONFIG.hud.button.restRollDeg * rad, scale: 1 });
  assert.equal(buttonPose({ ...base, intro: 0 }, CONFIG).scale, 0);
  const pressed = buttonPose({ ...base, press: 1 }, CONFIG);
  assert.ok(pressed.dz < 0 && pressed.scale < 1);
  assert.ok(buttonPose({ ...base, hover: 1 }, CONFIG).scale > 1);
  const gone = buttonPose({ ...base, outro: 1 }, CONFIG);
  assert.equal(gone.scale, 0);
  assert.ok(gone.dy < 0);
});

test("the island starts under the water, small and turned, and ends at rest", () => {
  const start = islandPose({ rise: 0, grow: 0, spin: 0 }, CONFIG);
  assert.equal(start.y, CONFIG.intro.riseFromY);
  assert.equal(start.scale, CONFIG.intro.growFromScale);
  assert.ok(Math.abs(start.yaw - CONFIG.intro.spinFromDeg * rad) < 1e-9);
  assert.deepEqual(islandPose({ rise: 1, grow: 1, spin: 1 }, CONFIG), { y: 0, scale: 1, yaw: 0 });
});

const view = (viewW: number, viewH: number) => ({ seconds: 0, viewW, viewH, dive: 0, parallaxX: 0, parallaxY: 0, dragDeg: 0 });

for (const [name, w, h] of [["phone", 402, 874], ["desktop", 1440, 900]] as const) {
  test(`${name}: the island is as wide on screen as the config asks`, () => {
    const pose = cameraPose(view(w, h), CONFIG);
    const pxPerUnit = h / (2 * pose.distance * Math.tan((CONFIG.camera.fovDeg * rad) / 2));
    const diameterPx = 2 * CONFIG.world.shore.radius * pxPerUnit;
    const want = Math.min(w * CONFIG.camera.islandDiameterOfW, h * CONFIG.camera.islandDiameterOfH);
    assert.ok(Math.abs(diameterPx - want) < 1e-6, `${diameterPx} vs ${want}`);
  });
}

test("the camera circles at the configured speed", () => {
  const a = cameraPose({ ...view(402, 874), seconds: 10 }, CONFIG);
  const b = cameraPose({ ...view(402, 874), seconds: 11 }, CONFIG);
  assert.ok(Math.abs(b.azimuthDeg - a.azimuthDeg - CONFIG.camera.orbitDegPerSec) < 1e-9);
});

test("the pointer and a drag nudge the camera", () => {
  const base = cameraPose(view(402, 874), CONFIG);
  const moved = cameraPose({ ...view(402, 874), parallaxX: 1, parallaxY: 1, dragDeg: 30 }, CONFIG);
  assert.ok(Math.abs(moved.azimuthDeg - base.azimuthDeg - 30 - CONFIG.camera.parallaxAzimuthDeg) < 1e-9);
  assert.ok(Math.abs(moved.elevationDeg - base.elevationDeg - CONFIG.camera.parallaxElevationDeg) < 1e-9);
});

test("after BEGIN the camera drops in close and low", () => {
  const base = cameraPose(view(402, 874), CONFIG);
  const dived = cameraPose({ ...view(402, 874), dive: 1 }, CONFIG);
  assert.ok(Math.abs(dived.distance - base.distance * CONFIG.outro.diveDistance) < 1e-9);
  assert.equal(dived.elevationDeg, CONFIG.outro.diveElevationDeg);
  assert.ok(Math.abs(dived.azimuthDeg - base.azimuthDeg - CONFIG.outro.diveOrbitDeg) < 1e-9);
});

test("the camera tips up so the island sits below the middle of the screen", () => {
  const pose = cameraPose(view(402, 874), CONFIG);
  const shiftOfH = Math.tan(pose.tiltUpRad) / (2 * Math.tan((CONFIG.camera.fovDeg * rad) / 2));
  assert.ok(Math.abs(shiftOfH - CONFIG.camera.islandCenterBelowMiddle) < 1e-9);
});

test("one pixel on the title plane is the same size as one pixel on screen", () => {
  const u = hudUnitsPerPx(874, CONFIG);
  const planeHeight = 2 * CONFIG.hud.distance * Math.tan((CONFIG.camera.fovDeg * rad) / 2);
  assert.ok(Math.abs(u * 874 - planeHeight) < 1e-9);
});

test("a coin turn spins a tile about its upright axis", () => {
  const p = tilePose({ ...still, coin: 1.5 }, CONFIG);
  assert.ok(Math.abs(p.rotY - (rest.yaw + 1.5)) < 1e-9);
  assert.equal(p.rotX, rest.pitch);
});
