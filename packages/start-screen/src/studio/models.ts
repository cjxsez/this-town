/**
 * Extra models for the app's artwork, built the same way as the island: flat
 * colours, one id per piece that should get an ink outline.
 *
 * - a rider figure, one unit tall
 * - the Ray-Ban style glasses
 */
import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  IcosahedronGeometry,
  LatheGeometry,
  Matrix4,
  Quaternion,
  Vector2,
  Vector3,
  type BufferGeometry,
} from "three";
import type { Config } from "../config";
import { GeoBuilder, type IdAllocator, place, placeTurned } from "../scene/builder";
import { roundedRect } from "../scene/hud";

type Colors = Config["colors"];
const RAD = Math.PI / 180;
const Z = new Vector3(0, 0, 1);

const ball = (radius: number) => new IcosahedronGeometry(radius, 2);
const at = (x: number, y: number, z: number, sx = 1, sy = sx, sz = sx) => place(x, y, z, 0, sx, sy, sz);

/** The direction `az` degrees round from straight ahead and `el` degrees up. */
const direction = (az: number, el: number) =>
  new Vector3(Math.sin(az * RAD) * Math.cos(el * RAD), Math.sin(el * RAD), Math.cos(az * RAD) * Math.cos(el * RAD));

/**
 * A matrix that moves a shape `distance` out from `center` in a direction and
 * turns it to face that way. `axis` says which way the shape faces to begin
 * with: discs face +Z, cones point +Y.
 */
function outward(axis: Vector3, az: number, el: number, distance: number, center = new Vector3(), scale = 1): Matrix4 {
  const dir = direction(az, el);
  return new Matrix4().compose(
    dir.clone().multiplyScalar(distance).add(center),
    new Quaternion().setFromUnitVectors(axis, dir),
    new Vector3(scale, scale, scale),
  );
}

// ---------------------------------------------------------------- rider figure

export interface FigureLook {
  shirt: string;
  hair: string;
  /** Colour of the badge on the chest. */
  badge: string;
}

/** A toy rider one unit tall, feet on y = 0, facing +Z, wearing a badge. */
export interface FigurePose {
  /**
   * Each arm's angle out from hanging straight down, in degrees, for the figure's own
   * left side (x < 0) and right side (x > 0): 0 = down, 90 = straight out, 180 = straight up.
   */
  arms: readonly [number, number];
}

const SHOULDER_Y = 0.62;
const SHOULDER_X = 0.2;
const ARM_LENGTH = 0.32;

/** Where a hand ends up for an arm on `side` (-1 left, 1 right) raised `deg` degrees. */
export function handPosition(side: -1 | 1, deg: number): { x: number; y: number } {
  const a = deg * RAD;
  return { x: side * (SHOULDER_X + ARM_LENGTH * Math.sin(a)), y: SHOULDER_Y - ARM_LENGTH * Math.cos(a) };
}

export function figureGeometry(look: FigureLook, C: Colors, ids: IdAllocator, pose: FigurePose = { arms: [12, 12] }): BufferGeometry {
  const b = new GeoBuilder();
  const id = ids.next();
  // Legs, a bean-shaped body turned on a lathe, arms with hands, head, hair.
  for (const s of [-1, 1] as const) {
    b.add(new CylinderGeometry(0.065, 0.075, 0.22, 8), at(s * 0.09, 0.11, 0), C.inkSoft, id);
    const deg = pose.arms[s < 0 ? 0 : 1];
    const mid = handPosition(s, deg);
    const a = deg * RAD;
    // The arm is an ellipsoid from shoulder to hand, turned to point along the arm.
    const cx = s * SHOULDER_X + (mid.x - s * SHOULDER_X) / 2;
    const cy = SHOULDER_Y + (mid.y - SHOULDER_Y) / 2;
    b.add(ball(1), placeTurned(cx, cy, 0, 0, 0, s * a).multiply(at(0, 0, 0, 0.065, ARM_LENGTH / 2 + 0.02, 0.065)), look.shirt, id);
    b.add(ball(0.06), at(mid.x, mid.y, 0), C.sand, id);
  }
  const profile = [
    [0.001, 0.2], [0.19, 0.2], [0.235, 0.32], [0.23, 0.48], [0.17, 0.62], [0.09, 0.69], [0.001, 0.7],
  ].map(([r, y]) => new Vector2(r, y));
  b.add(new LatheGeometry(profile, 16), at(0, 0, 0), look.shirt, id);
  const head = new Vector3(0, 0.83, 0);
  b.add(ball(0.185), at(head.x, head.y, head.z), C.sand, id);
  // Hair: a cap over the top and back of the head.
  b.add(ball(0.2), placeTurned(0, head.y + 0.035, -0.03, -24 * RAD, 0, 0).multiply(at(0, 0, 0, 1, 0.82, 1)), look.hair, id);
  for (const s of [-1, 1]) b.add(new CircleGeometry(0.022, 10), outward(Z, s * 22, -4, 0.185 + 0.012, head), C.ink, id);
  // The badge every rider wears, with its own outline.
  b.add(new CircleGeometry(0.07, 16), at(0.09, 0.5, 0.236), look.badge, ids.next());
  return b.build();
}

// ---------------------------------------------------------------- glasses

/** Chunky display glasses, about 2.5 units wide, lenses facing +Z. */
export function glassesGeometry(C: Colors, ids: IdAllocator): BufferGeometry {
  const b = new GeoBuilder();
  const id = ids.next();
  const lensW = 0.92;
  const lensH = 0.72;
  const rim = 0.1;
  const frame = roundedRect(lensW + rim * 2, lensH + rim * 2, [0.2, 0.2, 0.3, 0.3]);
  frame.holes.push(roundedRect(lensW, lensH, [0.14, 0.14, 0.24, 0.24]));
  for (const s of [-1, 1]) {
    const x = s * (lensW / 2 + rim + 0.11);
    b.add(new ExtrudeGeometry(frame, { depth: 0.14, bevelEnabled: false, curveSegments: 6 }), at(x, 0, -0.07), C.inkDeep, id);
    b.add(new BoxGeometry(lensW + 0.02, lensH + 0.02, 0.03), at(x, 0, 0), C.inkSoft, id);
    b.add(new BoxGeometry(0.09, 0.13, 1.5), placeTurned(s * (lensW + rim * 2 + 0.1), 0.2, -0.78, 0, s * 4 * RAD, 0), C.inkDeep, id);
  }
  b.add(new BoxGeometry(0.24, 0.1, 0.12), at(0, 0.16, 0), C.inkDeep, id);
  // The little display in the right lens.
  b.add(new BoxGeometry(0.3, 0.22, 0.01), at(lensW / 2 + rim + 0.11 + 0.14, -0.08, 0.022), C.leaf, ids.next());
  return b.build();
}
