/**
 * Extra models for the app's artwork, built the same way as the island: flat
 * colours, one id per piece that should get an ink outline.
 *
 * - badge animals (the eight on the printed badges), as paper-white heads that
 *   read on any badge colour
 * - a rider figure, one unit tall
 * - the Ray-Ban style glasses
 * - the three Kenmore meeting spots, each a small scene on a platform
 */
import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  RingGeometry,
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
import { faces, flatQuad, wallQuad } from "../scene/world";

type Colors = Config["colors"];
const RAD = Math.PI / 180;
const Y = new Vector3(0, 1, 0);
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

// ---------------------------------------------------------------- badge animals

export const ANIMALS = ["cat", "bear", "frog", "owl", "rabbit", "fox", "duck", "deer"] as const;
export type Animal = (typeof ANIMALS)[number];

/** A head about one unit across, centred near the origin, looking down +Z. */
export function animalGeometry(animal: Animal, C: Colors, ids: IdAllocator): BufferGeometry {
  const b = new GeoBuilder();
  const id = ids.next();
  const fur = C.paper;
  const R = 0.5;
  const origin = new Vector3();

  const head = (sx = 1, sy = 1, sz = 1) => b.add(ball(R), at(0, 0, 0, sx, sy, sz), fur, id);
  /** A flat dot lying on a ball of `radius` round `center`. */
  const dot = (az: number, el: number, size: number, color: string, center = origin, radius = R, own = id) =>
    b.add(new CircleGeometry(size, 14), outward(Z, az, el, radius + 0.014, center), color, own);
  const eyes = (az: number, el: number, size = 0.06, center = origin, radius = R) => {
    dot(-az, el, size, C.ink, center, radius);
    dot(az, el, size, C.ink, center, radius);
  };
  /** A pointed ear: a three-sided cone standing on the head. */
  const ear = (az: number, el: number, radius: number, height: number, color = fur) =>
    b.add(new ConeGeometry(radius, height, 3), outward(Y, az, el, R + height * 0.32), color, id);
  const pair = (fn: (side: 1 | -1) => void) => {
    fn(-1);
    fn(1);
  };

  switch (animal) {
    case "cat":
      head();
      pair((s) => ear(s * 36, 50, 0.2, 0.36));
      eyes(22, 8);
      dot(0, -8, 0.04, C.rust);
      break;
    case "bear":
      head();
      pair((s) => b.add(ball(0.17), outward(Z, s * 42, 50, R), fur, id));
      eyes(20, 12, 0.055);
      b.add(ball(0.2), at(0, -0.12, 0.4, 1, 0.82, 0.7), C.sand, id);
      b.add(new CircleGeometry(0.06, 14), at(0, -0.08, 0.556), C.ink, id);
      break;
    case "frog": {
      head(1.12, 0.78, 0.95);
      pair((s) => {
        const bump = new Vector3(s * 0.28, 0.36, 0.1);
        b.add(ball(0.18), at(bump.x, bump.y, bump.z), fur, id);
        dot(s * 6, 4, 0.075, C.ink, bump, 0.18);
      });
      pair((s) => b.add(new CircleGeometry(0.022, 10), at(s * 0.07, 0.02, 0.492), C.ink, id));
      // A wide smile.
      b.add(new RingGeometry(0.25, 0.285, 18, 1, Math.PI * 1.2, Math.PI * 0.6), at(0, 0.16, 0.49), C.ink, id);
      break;
    }
    case "owl":
      head();
      pair((s) => ear(s * 34, 56, 0.13, 0.26));
      pair((s) => {
        const rim = ids.next();
        dot(s * 24, 8, 0.17, C.paperLo, origin, R, rim);
        b.add(new CircleGeometry(0.075, 14), outward(Z, s * 24, 8, R + 0.028), C.ink, rim);
      });
      b.add(new ConeGeometry(0.08, 0.2, 4), outward(Y, 0, -16, R + 0.06), C.yellow, id);
      break;
    case "rabbit":
      head(0.92, 0.9, 0.9);
      pair((s) => b.add(ball(1), placeTurned(s * 0.19, 0.72, -0.02, 0, 0, -s * 8 * RAD).multiply(at(0, 0, 0, 0.13, 0.42, 0.08)), fur, id));
      eyes(22, 8, 0.055, origin, R * 0.91);
      dot(0, -10, 0.04, C.rust, origin, R * 0.9);
      break;
    case "fox":
      head(1, 0.92, 0.92);
      pair((s) => ear(s * 36, 50, 0.21, 0.42));
      pair((s) => b.add(new ConeGeometry(0.14, 0.3, 3), outward(Y, s * 80, -24, R + 0.02), fur, id));
      b.add(new ConeGeometry(0.21, 0.42, 12), outward(Y, 0, -14, R + 0.1), fur, id);
      b.add(ball(0.06), outward(Z, 0, -14, R + 0.31), C.ink, id);
      eyes(26, 12, 0.055, origin, R * 0.94);
      break;
    case "duck": {
      head(0.9, 0.9, 0.9);
      const bill = ids.next();
      b.add(ball(1), at(0, -0.07, 0.5, 0.25, 0.075, 0.22), C.yellow, bill);
      eyes(28, 14, 0.055, origin, R * 0.9);
      b.add(new ConeGeometry(0.07, 0.2, 3), outward(Y, 0, 86, R * 0.9 + 0.05), fur, id);
      break;
    }
    case "deer":
      head(0.86, 0.96, 0.9);
      b.add(ball(1), at(0, -0.17, 0.34, 0.19, 0.16, 0.22), C.sand, id);
      b.add(new CircleGeometry(0.055, 14), at(0, -0.14, 0.574), C.ink, id);
      eyes(26, 12, 0.055, origin, R * 0.88);
      pair((s) => {
        b.add(ball(1), placeTurned(s * 0.5, 0.2, 0, 0, 0, s * 22 * RAD).multiply(at(0, 0, 0, 0.2, 0.08, 0.05)), fur, id);
        const antler = ids.next();
        b.add(new CylinderGeometry(0.035, 0.045, 0.5, 6), placeTurned(s * 0.22, 0.66, 0, 0, 0, -s * 18 * RAD), C.inkSoft, antler);
        b.add(new CylinderGeometry(0.03, 0.035, 0.24, 6), placeTurned(s * 0.37, 0.76, 0, 0, 0, -s * 62 * RAD), C.inkSoft, antler);
      });
      break;
  }
  return b.build();
}

// ---------------------------------------------------------------- rider figure

export interface FigureLook {
  shirt: string;
  hair: string;
  /** Colour of the badge on the chest. */
  badge: string;
}

/** A toy rider one unit tall, feet on y = 0, facing +Z, wearing a badge. */
export function figureGeometry(look: FigureLook, C: Colors, ids: IdAllocator): BufferGeometry {
  const b = new GeoBuilder();
  const id = ids.next();
  // Legs, a bean-shaped body turned on a lathe, arms, head, hair.
  for (const s of [-1, 1]) {
    b.add(new CylinderGeometry(0.065, 0.075, 0.22, 8), at(s * 0.09, 0.11, 0), C.inkSoft, id);
    b.add(ball(1), placeTurned(s * 0.25, 0.47, 0, 0, 0, s * 10 * RAD).multiply(at(0, 0, 0, 0.06, 0.16, 0.06)), look.shirt, id);
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

// ---------------------------------------------------------------- meeting spots

export const SPOTS = ["system-map", "third-bench", "comm-ave-stairs"] as const;
export type Spot = (typeof SPOTS)[number];

/** A slice of platform (yellow edge towards +Z) with the thing riders meet at. */
export function spotGeometry(spot: Spot, config: Config, ids: IdAllocator): BufferGeometry {
  const C = config.colors;
  const [green, red, orange, blue] = config.lineColors;
  const b = new GeoBuilder();
  const top = 0.6;
  const platform = ids.next();
  b.add(new BoxGeometry(10, top, 3.4), at(0, top / 2, 0), faces(C.paperLo, C.stoneDk), platform);
  b.add(flatQuad(9.8, 0.5), at(0, top + 0.012, 1.4), C.yellow, platform);

  if (spot === "system-map") {
    const id = ids.next();
    for (const s of [-1, 1]) b.add(new BoxGeometry(0.22, 2.5, 0.22), at(s * 1.7, top + 1.25, -0.4), C.inkSoft, id);
    b.add(new BoxGeometry(4.2, 2.5, 0.24), at(0, top + 2.2, -0.4), faces(C.paperLo, C.paper), id);
    const on = (x: number, y: number, turn = 0) => placeTurned(x, top + 2.2 + y, -0.27, 0, 0, turn * RAD);
    b.add(wallQuad(3.5, 0.17), on(0, 0.1), green!, id);
    b.add(wallQuad(3.1, 0.17), on(-0.1, 0.05, 32), red!, id);
    b.add(wallQuad(2.9, 0.17), on(0.3, -0.05, -30), orange!, id);
    b.add(wallQuad(1.5, 0.17), on(1.05, 0.62, 12), blue!, id);
    for (const x of [-1.4, -0.7, 0.75, 1.45]) b.add(new CircleGeometry(0.1, 12), on(x, 0.1).multiply(at(0, 0, 0.004)), C.paper, id);
    // You are here.
    b.add(new CircleGeometry(0.2, 16), on(0.05, 0.1).multiply(at(0, 0, 0.008)), C.yellow, ids.next());
  }

  if (spot === "third-bench") {
    [-3.1, 0, 3.1].forEach((x, i) => {
      const id = ids.next();
      const wood = i === 2 ? C.yellow : C.sand;
      b.add(new BoxGeometry(2.3, 0.16, 0.75), at(x, top + 0.62, -0.3), faces(wood, i === 2 ? C.yellowDk : C.stone), id);
      b.add(new BoxGeometry(2.3, 0.62, 0.14), at(x, top + 1.05, -0.68), i === 2 ? C.yellow : C.sand, id);
      for (const s of [-1, 1]) b.add(new BoxGeometry(0.16, 0.56, 0.6), at(x + s * 0.9, top + 0.28, -0.3), C.inkSoft, id);
    });
  }

  if (spot === "comm-ave-stairs") {
    const id = ids.next();
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      const h = 0.34 * (i + 1);
      b.add(new BoxGeometry(3.2, h, 0.46), at(-0.4, top + h / 2, 0.9 - i * 0.46), faces(C.paper, C.stone), id);
    }
    const wallH = 0.34 * steps + 0.5;
    for (const s of [-1, 1]) b.add(new BoxGeometry(0.26, wallH, 3.4), at(-0.4 + s * 1.73, top + wallH / 2, -0.3), faces(C.paperLo, C.stone), ids.next());
    // The street sign at the foot of the stairs.
    const sign = ids.next();
    b.add(new BoxGeometry(0.2, 2.6, 0.2), at(3, top + 1.3, 0.5), C.inkSoft, sign);
    b.add(new BoxGeometry(2.3, 0.9, 0.22), at(3, top + 2.75, 0.5), C.paper, sign);
    b.add(wallQuad(2.16, 0.3), at(3, top + 2.5, 0.62), green!, sign);
  }
  return b.build();
}
