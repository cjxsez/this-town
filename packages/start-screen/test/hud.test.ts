import { test } from "node:test";
import assert from "node:assert/strict";
import { Material } from "three";
import { CONFIG } from "../src/config";
import { computeLayout, roundelMask } from "../src/core/layout";
import { hexToRgb, IdAllocator } from "../src/scene/builder";
import { buildHud } from "../src/scene/hud";

const materials = { world: new Material(), hud: new Material(), foam: new Material(), dropShadow: new Material() };
const layout = computeLayout(402, 874, "IN THIS TOWN", CONFIG);
const chars = layout.tiles.map((t) => t.char);
// A stand-in for the real glyph texture: each key owns a known patch of it.
const keys = [...new Set(chars), "roundel:T", "label"];
const atlas = {
  rect: (key: string) => {
    const i = keys.indexOf(key);
    return { u0: i / keys.length, v0: 0.2, u1: (i + 1) / keys.length, v1: 0.8 };
  },
};
const roundels = roundelMask("IN THIS TOWN", CONFIG.hud.roundel);
const isRoundel = (i: number) => roundels[i] === true;
const hud = buildHud(chars, roundels, CONFIG, new IdAllocator(), atlas, materials);
const T = CONFIG.hud.title;

/** Where something on (or behind) the title plane appears on screen, and how big, in title-plane units. */
type Placed = { position: { x: number; y: number; z: number }; scale: { x: number } };
const seen = (o: Placed) => {
  const k = CONFIG.hud.distance / (CONFIG.hud.distance - o.position.z);
  return { x: o.position.x * k, y: o.position.y * k, size: o.scale.x * k };
};

test("one tile per letter plus the button", () => {
  assert.equal(hud.tiles.length, 10);
  assert.ok(hud.button.mesh);
});

test("a tile is one unit wide, as tall as its aspect, as deep as configured", () => {
  const g = hud.tiles[0]!.mesh.geometry;
  g.computeBoundingBox();
  const { min, max } = g.boundingBox!;
  assert.ok(Math.abs(max.x - 0.5) < 1e-6 && Math.abs(min.x + 0.5) < 1e-6);
  assert.ok(Math.abs(max.y - T.tileAspect / 2) < 1e-6 && Math.abs(min.y + T.tileAspect / 2) < 1e-6);
  assert.ok(Math.abs(max.z - T.depth / 2) < 1e-6 && Math.abs(min.z + T.depth / 2) < 1e-6);
});

test("every tile and the button is its own inked piece", () => {
  const ids = [...hud.tiles.map((t) => t.mesh), hud.button.mesh].map((m) => m.geometry.getAttribute("oid").getX(0));
  assert.equal(new Set(ids).size, 11);
  assert.ok(ids.every((id) => id > 0));
});

test("only the front of a tile carries its letter", () => {
  hud.tiles.forEach((tile, index) => {
    const g = tile.mesh.geometry;
    const uv = g.getAttribute("uv");
    const n = g.getAttribute("normal");
    const rect = atlas.rect(isRoundel(index) ? "roundel:T" : chars[index]!);
    let front = 0;
    for (let i = 0; i < uv.count; i++) {
      if (n.getZ(i) > 0.9) {
        front++;
        assert.ok(uv.getX(i) >= rect.u0 - 1e-6 && uv.getX(i) <= rect.u1 + 1e-6);
        assert.ok(uv.getY(i) >= rect.v0 - 1e-6 && uv.getY(i) <= rect.v1 + 1e-6);
      } else {
        assert.equal(uv.getX(i), -1);
      }
    }
    assert.ok(front >= 6);
  });
});

test("tile fronts are paper and backs cycle through the line colours", () => {
  hud.tiles.forEach((tile, index) => {
    if (isRoundel(index)) return;
    const g = tile.mesh.geometry;
    const n = g.getAttribute("normal");
    const c = g.getAttribute("color");
    const paper = hexToRgb(CONFIG.colors.paper);
    const back = hexToRgb(CONFIG.lineColors[index % CONFIG.lineColors.length]!);
    for (let i = 0; i < n.count; i++) {
      const want = n.getZ(i) > 0.9 ? paper : n.getZ(i) < -0.9 ? back : null;
      if (want) assert.ok(Math.abs(c.getX(i) - want[0]) < 1e-6 && Math.abs(c.getY(i) - want[1]) < 1e-6);
    }
  });
});

test("tiles rest tipped back, each with its own small turn, the same every time", () => {
  const rad = Math.PI / 180;
  for (const tile of hud.tiles) {
    assert.ok(Math.abs(tile.rest.pitch - T.restPitchDeg * rad) < 1e-9);
    assert.ok(Math.abs(tile.rest.yaw) <= T.restYawDeg * rad + 1e-9);
    assert.ok(Math.abs(tile.rest.roll) <= T.restRollDeg * rad + 1e-9);
  }
  assert.ok(new Set(hud.tiles.map((t) => t.rest.roll)).size > 1);
  const again = buildHud(chars, roundels, CONFIG, new IdAllocator(), atlas, materials);
  assert.deepEqual(again.tiles.map((t) => t.rest), hud.tiles.map((t) => t.rest));
});

test("applying a layout puts each tile on its slot at the right size", () => {
  const unitsPerPx = 0.05;
  hud.setLayout(layout, unitsPerPx);
  hud.tiles.forEach((tile, i) => {
    const slot = layout.tiles[i]!;
    assert.ok(Math.abs(tile.home.x - slot.cx * unitsPerPx) < 1e-9);
    assert.ok(Math.abs(tile.home.y - slot.cy * unitsPerPx) < 1e-9);
    assert.ok(Math.abs(tile.size - layout.tileW * unitsPerPx) < 1e-9);
  });
  assert.ok(Math.abs(hud.button.home.y - layout.button.cy * unitsPerPx) < 1e-9);
  assert.ok(Math.abs(hud.button.size - layout.button.h * unitsPerPx) < 1e-9);
});

test("each tile and the button has a drop shadow that is not a shadow caster or inked", () => {
  for (const view of [...hud.tiles, hud.button]) {
    assert.equal(view.shadow.material, materials.dropShadow);
    assert.equal(view.mesh.material, materials.hud);
    assert.equal(view.shadow.layers.mask & 2, 0);
    assert.equal(view.mesh.layers.mask & 2, 0);
  }
});

test("posing a tile moves, turns and scales it, and its drop shadow follows down-right and behind", () => {
  hud.setLayout(layout, 0.05);
  const tile = hud.tiles[2]!;
  hud.poseTile(2, { dy: 0.5, dz: 0, rotX: 0.3, rotY: 0.1, rotZ: -0.05, scale: 0.5 });
  const { mesh, shadow, home, size } = tile;
  assert.ok(Math.abs(mesh.position.x - home.x) < 1e-9);
  assert.ok(Math.abs(mesh.position.y - (home.y + 0.5 * size * T.tileAspect)) < 1e-9);
  assert.ok(Math.abs(mesh.scale.x - size * 0.5) < 1e-9);
  // Rotations are measured from the line of sight, so the piece is first turned to face the viewer.
  const d = CONFIG.hud.distance;
  assert.ok(Math.abs(mesh.rotation.x - (0.3 + Math.atan2(mesh.position.y, d))) < 1e-9);
  assert.ok(Math.abs(mesh.rotation.y - (0.1 - Math.atan2(home.x, d))) < 1e-9);
  assert.ok(seen(shadow).x > seen(mesh).x && seen(shadow).y < seen(mesh).y);
  assert.ok(shadow.position.z < mesh.position.z);
});

test("a tile with no size is hidden, and shown again when it has one", () => {
  const pose = { dy: 0, dz: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 0 };
  hud.poseTile(0, pose);
  assert.equal(hud.tiles[0]!.mesh.visible, false);
  assert.equal(hud.tiles[0]!.shadow.visible, false);
  hud.poseTile(0, { ...pose, scale: 1 });
  assert.equal(hud.tiles[0]!.mesh.visible, true);
  assert.equal(hud.tiles[0]!.shadow.visible, true);
});

test("a lifted tile throws its shadow further; a pressed button pulls its shadow in", () => {
  hud.setLayout(layout, 0.05);
  const flat = { dy: 0, dz: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1 };
  const offset = (v: { mesh: Placed; shadow: Placed }) => seen(v.shadow).x - seen(v.mesh).x;
  hud.poseTile(1, flat);
  const resting = offset(hud.tiles[1]!);
  hud.poseTile(1, { ...flat, dz: 0.6 });
  assert.ok(offset(hud.tiles[1]!) > resting);

  hud.poseButton({ dy: 0, dz: 0, rotX: 0, rotZ: 0, scale: 1 });
  const up = offset(hud.button);
  hud.poseButton({ dy: 0, dz: -0.55, rotX: 0, rotZ: 0, scale: 1 });
  assert.ok(offset(hud.button) < up && offset(hud.button) > 0);
  assert.ok(hud.button.mesh.position.z < 0);
});

test("every piece is turned to face the viewer, so they all show the same amount of edge", () => {
  hud.setLayout(layout, 0.05);
  const flat = { dy: 0, dz: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1 };
  hud.tiles.forEach((_, i) => hud.poseTile(i, flat));
  hud.poseButton(flat);
  const first = hud.tiles[0]!; // top row, left of centre
  const last = hud.tiles[4]!; // top row, right of centre
  assert.ok(first.mesh.rotation.x > 0, "above the middle: tipped forward");
  assert.ok(hud.button.mesh.rotation.x < 0, "below the middle: tipped back");
  assert.ok(first.mesh.rotation.y > 0 && last.mesh.rotation.y < 0, "sides turn in towards the middle");
  assert.equal(hud.button.mesh.rotation.y, 0);
  // The drop shadow stays parallel to the piece's resting face.
  assert.ok(Math.abs(first.shadow.rotation.x - (first.mesh.rotation.x - first.rest.pitch)) < 1e-9);
});

test("a drop shadow looks the same size as its piece and sits a fixed offset away, though it is further back", () => {
  hud.setLayout(layout, 0.05);
  const flat = { dy: 0, dz: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1 };
  const D = CONFIG.hud.dropShadow;
  const tileSize = layout.tileW * 0.05;
  hud.poseTile(0, flat);
  hud.poseButton(flat);
  for (const view of [hud.tiles[0]!, hud.button]) {
    const piece = seen(view.mesh);
    const shadow = seen(view.shadow);
    assert.ok(Math.abs(shadow.size - piece.size) < 1e-9, "same size on screen");
    assert.ok(Math.abs(shadow.x - piece.x - D.x * tileSize) < 1e-9, "same sideways offset for tiles and button");
    assert.ok(Math.abs(shadow.y - piece.y - D.y * tileSize) < 1e-9);
  }
});

test("the T of TOWN is a round green roundel; the T of THIS is a plain tile", () => {
  const R = CONFIG.hud.roundel;
  const green = hexToRgb(CONFIG.colors[R.face]);
  assert.deepEqual(hud.tiles.map((t) => t.roundel), chars.map((_, i) => i === 6));
  hud.tiles.forEach((tile, index) => {
    if (!isRoundel(index)) return;
    const g = tile.mesh.geometry;
    g.computeBoundingBox();
    const { min, max } = g.boundingBox!;
    assert.ok(Math.abs(max.x - R.diameter / 2) < 1e-3 && Math.abs(min.y + R.diameter / 2) < 1e-3, "a disc");
    const p = g.getAttribute("position");
    const n = g.getAttribute("normal");
    const c = g.getAttribute("color");
    for (let i = 0; i < p.count; i++) {
      // Every point of the rim is the same distance from the middle.
      if (Math.abs(n.getZ(i)) < 0.1) assert.ok(Math.abs(Math.hypot(p.getX(i), p.getY(i)) - R.diameter / 2) < 1e-3);
      if (n.getZ(i) > 0.9) assert.ok(Math.abs(c.getX(i) - green[0]) < 1e-6 && Math.abs(c.getY(i) - green[1]) < 1e-6);
    }
  });
});
