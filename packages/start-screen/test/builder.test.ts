import { test } from "node:test";
import assert from "node:assert/strict";
import { BoxGeometry, Matrix4, SphereGeometry } from "three";
import { GeoBuilder, hexToRgb, IdAllocator, place } from "../src/scene/builder";

const attr = (g: ReturnType<GeoBuilder["build"]>, name: string) => g.getAttribute(name);

test("hexToRgb reads #rrggbb as 0..1", () => {
  const [r, g, b] = hexToRgb("#ff8000");
  assert.equal(r, 1);
  assert.ok(Math.abs(g - 128 / 255) < 1e-9);
  assert.equal(b, 0);
});

test("ids start at 1 because 0 means background", () => {
  const ids = new IdAllocator();
  assert.equal(ids.next(), 1);
  assert.equal(ids.next(), 2);
});

test("a box is moved by its matrix and keeps its 12 triangles", () => {
  const g = new GeoBuilder().add(new BoxGeometry(1, 1, 1), place(10, 0, 0), "#ffffff", 7).build();
  const p = attr(g, "position");
  assert.equal(p.count, 36);
  for (let i = 0; i < p.count; i++) {
    assert.ok(p.getX(i) >= 9.5 - 1e-6 && p.getX(i) <= 10.5 + 1e-6);
    assert.equal(attr(g, "oid").getX(i), 7);
  }
});

test("paint can depend on which way a face points", () => {
  const paint = (n: { y: number }) => (n.y > 0.5 ? "#ff0000" : "#0000ff");
  const g = new GeoBuilder().add(new BoxGeometry(2, 2, 2), new Matrix4(), paint, 1).build();
  const p = attr(g, "position");
  const n = attr(g, "normal");
  const c = attr(g, "color");
  let top = 0;
  for (let i = 0; i < p.count; i++) {
    const isTop = n.getY(i) > 0.5;
    if (isTop) top++;
    assert.equal(c.getX(i), isTop ? 1 : 0);
    assert.equal(c.getZ(i), isTop ? 0 : 1);
  }
  assert.equal(top, 6);
});

test("round shapes get one flat normal per triangle", () => {
  const g = new GeoBuilder().add(new SphereGeometry(1, 8, 6), new Matrix4(), "#ffffff", 1).build();
  const n = attr(g, "normal");
  assert.ok(n.count > 0 && n.count % 3 === 0);
  for (let i = 0; i < n.count; i += 3) {
    for (const j of [i + 1, i + 2]) {
      assert.ok(Math.abs(n.getX(i) - n.getX(j)) < 1e-6 && Math.abs(n.getY(i) - n.getY(j)) < 1e-6);
    }
    const length = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
    assert.ok(Math.abs(length - 1) < 1e-5);
  }
});

test("normals point outwards even when the matrix mirrors the shape", () => {
  const mirror = new Matrix4().makeScale(-1, 1, 1);
  const g = new GeoBuilder().add(new BoxGeometry(2, 2, 2), mirror, "#ffffff", 1).build();
  const p = attr(g, "position");
  const n = attr(g, "normal");
  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    assert.ok(cx * n.getX(i) + cy * n.getY(i) + cz * n.getZ(i) > 0);
  }
});

test("pieces with no texture get uv (-1,-1); pieces with one get what was asked", () => {
  const g = new GeoBuilder()
    .add(new BoxGeometry(1, 1, 1), new Matrix4(), "#ffffff", 1)
    .add(new BoxGeometry(1, 1, 1), place(5, 0, 0), "#ffffff", 2, (n) => (n.z > 0.5 ? [0.25, 0.75] : null))
    .build();
  const uv = attr(g, "uv");
  const n = attr(g, "normal");
  const id = attr(g, "oid");
  let mapped = 0;
  for (let i = 0; i < uv.count; i++) {
    if (id.getX(i) === 2 && n.getZ(i) > 0.5) {
      mapped++;
      assert.deepEqual([uv.getX(i), uv.getY(i)], [0.25, 0.75]);
    } else {
      assert.deepEqual([uv.getX(i), uv.getY(i)], [-1, -1]);
    }
  }
  assert.equal(mapped, 6);
});
