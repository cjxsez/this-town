/**
 * The little world behind the title: an island in the sea with a trolley loop.
 *
 * - shore and grass, a pond, a clock tower, a row of brick houses, trees and rocks
 * - a loop of track with three stops and a tunnel under a hill
 * - a two-car trolley that runs the loop on a timetable
 * - rings of foam on the water around the shore
 *
 * Everything static is merged into one mesh. Pieces that should get an ink
 * outline have their own id; painted details (ties, rails, windows, stripes)
 * share the id of the surface they lie on, so they stay line-free.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  PlaneGeometry,
  type Material,
} from "three";
import type { Config } from "../config";
import { mix } from "../core/ease";
import { mulberry32 } from "../core/rng";
import { trainCenterDeg } from "../core/train";
import { GeoBuilder, type IdAllocator, type Paint, place, placeTurned } from "./builder";

/** Meshes on this layer are drawn into the shadow map. */
export const SHADOW_LAYER = 1;

export interface SceneMaterials {
  /** Island and train: flat colour, receives cast shadows. */
  world: Material;
  /** Title tiles and button. */
  hud: Material;
  /** Foam on the water: colour only, no outline. */
  foam: Material;
  /** The hard drop shadows behind the tiles and button. */
  dropShadow: Material;
}

export interface SeaColors {
  readonly sea: string;
  readonly foam: string;
  readonly foam2: string;
}

export interface World {
  /** Everything that rises out of the sea in the intro. */
  group: Group;
  island: Mesh<BufferGeometry>;
  /** Foam rings. They stay on the water, so they are not inside `group`. */
  foam: Group;
  cars: Mesh<BufferGeometry>[];
  /** Where the trees ended up (for tests and debugging). */
  trees: { x: number; z: number; radius: number }[];
  /** Move the train and the foam to where they are at `seconds`. */
  update(seconds: number, foamGrow?: number): void;
  dispose(): void;
}

const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const IDENTITY = new Matrix4();
type Pt = readonly [number, number]; // x, z
type Lumps = ReadonlyArray<readonly [number, number]>;

/** Paint the top, the sides and the underside of a shape. */
const faces =
  (top: string, side: string, bottom = side): Paint =>
  (n) =>
    n.y > 0.5 ? top : n.y < -0.5 ? bottom : side;

const turnsApart = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

function triangles(positions: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return geometry;
}

/** A flat cap over a closed outline, facing up. */
function cap(points: readonly Pt[], y: number, cx = 0, cz = 0): BufferGeometry {
  const out: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    out.push(cx, y, cz, b[0], y, b[1], a[0], y, a[1]);
  }
  return triangles(out);
}

/** The wall under an outline. Faces outwards when the outline runs by increasing angle. */
function wall(points: readonly Pt[], y0: number, y1: number): BufferGeometry {
  const out: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    out.push(a[0], y0, a[1], a[0], y1, a[1], b[0], y0, b[1]);
    out.push(b[0], y0, b[1], a[0], y1, a[1], b[0], y1, b[1]);
  }
  return triangles(out);
}

function circle(radius: number, segments: number): Pt[] {
  return Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * TAU;
    return [radius * Math.cos(a), radius * Math.sin(a)] as const;
  });
}

/** A flat ring between two radii, facing up. */
function ringCap(inner: number, outer: number, y: number, segments: number): BufferGeometry {
  const a = circle(inner, segments);
  const b = circle(outer, segments);
  const out: number[] = [];
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    out.push(a[i]![0], y, a[i]![1], b[j]![0], y, b[j]![1], b[i]![0], y, b[i]![1]);
    out.push(a[i]![0], y, a[i]![1], a[j]![0], y, a[j]![1], b[j]![0], y, b[j]![1]);
  }
  return triangles(out);
}

/** Radius of a lumpy outline at an angle. */
function lumpyRadius(radius: number, lumps: Lumps, phases: readonly number[], angle: number): number {
  let r = radius;
  lumps.forEach(([lobes, amount], k) => {
    r += radius * amount * Math.sin(lobes * angle + (phases[k] ?? 0));
  });
  return r;
}

/** A closed, slightly lumpy outline: the hand-cut shape of the island, the pond, the foam. */
function blob(radius: number, lumps: Lumps, phases: readonly number[], segments: number, cx = 0, cz = 0): Pt[] {
  return Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * TAU;
    const r = lumpyRadius(radius, lumps, phases, a);
    return [cx + r * Math.cos(a), cz + r * Math.sin(a)] as const;
  });
}

/** A rectangle lying flat, facing up: `sx` along X, `sz` along Z. */
const flatQuad = (sx: number, sz: number) => new PlaneGeometry(sx, sz).rotateX(-Math.PI / 2);
/** A rectangle standing up, facing +Z. */
const wallQuad = (w: number, h: number) => new PlaneGeometry(w, h);

/** A pitched roof: ridge along X, eaves at y = 0. */
function gable(w: number, h: number, d: number): BufferGeometry {
  const x = w / 2;
  const z = d / 2;
  // prettier-ignore
  return triangles([
    -x, 0, z,   x, 0, z,   x, h, 0,     -x, 0, z,   x, h, 0,  -x, h, 0, // front slope
     x, 0, -z, -x, 0, -z, -x, h, 0,      x, 0, -z, -x, h, 0,   x, h, 0, // back slope
     x, 0, z,   x, 0, -z,  x, h, 0, // gable ends
    -x, 0, -z, -x, 0, z,  -x, h, 0,
  ]);
}

/** Keep the triangles of a shape that sit above its own middle. */
function upperHalf(geometry: BufferGeometry): BufferGeometry {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const p = source.getAttribute("position");
  const out: number[] = [];
  for (let i = 0; i + 2 < p.count; i += 3) {
    if (p.getY(i) + p.getY(i + 1) + p.getY(i + 2) <= 0.05) continue;
    for (let k = i; k < i + 3; k++) out.push(p.getX(k), p.getY(k), p.getZ(k));
  }
  return triangles(out);
}

/**
 * A frame on a circle around the island: local +Z points outwards, local X runs
 * along the circle. Stations, the tunnel and the houses are laid out in these.
 */
function ringFrame(radius: number, deg: number, y = 0): Matrix4 {
  const a = deg * RAD;
  return place(radius * Math.cos(a), y, radius * Math.sin(a), Math.PI / 2 - a);
}

function carGeometry(config: Config, id: number, lead: boolean, tail: boolean): BufferGeometry {
  const T = config.train;
  const C = config.colors;
  const L = T.carLength;
  const wide = T.carWidth;
  const skirt = T.skirtHeight;
  const bodyH = T.carHeight - skirt;
  const proud = 0.014; // painted details sit this far off the body
  const b = new GeoBuilder();

  b.add(new BoxGeometry(L * 0.92, skirt, wide * 0.84), place(0, skirt / 2, 0), C.stoneDk, id);
  b.add(new BoxGeometry(L, bodyH, wide), place(0, skirt + bodyH / 2, 0), faces(C.stone, C.paper), id);

  // Green Line stripe all the way round, then windows above it.
  const stripeY = skirt + bodyH * 0.25;
  const windowY = skirt + bodyH * 0.67;
  const windowH = bodyH * 0.36;
  const bay = (L * 0.88) / T.windows;
  for (const side of [1, -1]) {
    const yaw = side > 0 ? 0 : Math.PI;
    const z = side * (wide / 2 + proud);
    b.add(wallQuad(L * 0.985, T.stripeHeight), place(0, stripeY, z, yaw), C.green, id);
    for (let k = 0; k < T.windows; k++) {
      b.add(wallQuad(bay * 0.72, windowH), place((k - (T.windows - 1) / 2) * bay, windowY, z, yaw), C.inkSoft, id);
    }
  }
  for (const end of [1, -1]) {
    const yaw = (end * Math.PI) / 2;
    const x = end * (L / 2 + proud);
    b.add(wallQuad(wide * 0.985, T.stripeHeight), place(x, stripeY, 0, yaw), C.green, id);
    b.add(wallQuad(wide * 0.72, windowH), place(x, windowY, 0, yaw), C.inkSoft, id);
    // Headlights on the nose of the first car, tail lights on the back of the last.
    const light = end > 0 ? (lead ? C.yellow : null) : tail ? C.red : null;
    if (light) {
      for (const s of [1, -1]) {
        b.add(wallQuad(wide * 0.16, T.stripeHeight * 0.62), place(end * (L / 2 + proud * 1.6), stripeY, s * wide * 0.3, yaw), light, id);
      }
    }
  }
  // Bellows to the car behind.
  if (!tail) {
    b.add(new BoxGeometry(T.carGap + 0.3, bodyH * 0.82, wide * 0.7), place(-(L + T.carGap) / 2, skirt + bodyH * 0.43, 0), C.inkSoft, id);
  }
  return b.build();
}

export function buildWorld(config: Config, sea: SeaColors, ids: IdAllocator, materials: SceneMaterials): World {
  const W = config.world;
  const C = config.colors;
  const K = W.track;
  const S = W.stations;
  const U = W.tunnel;
  const T = config.train;
  const rand = mulberry32(W.seed);
  const range = (lo: number, hi: number) => lo + (hi - lo) * rand();
  const b = new GeoBuilder();
  const grassTop = W.grass.top;

  // ---- shore and grass: two lumpy slabs with the same outline
  const phases = W.outlineLumps.map(() => rand() * TAU);
  const shore = blob(W.shore.radius, W.outlineLumps, phases, W.outlineSegments);
  const shoreId = ids.next();
  b.add(cap(shore, W.shore.height), IDENTITY, C.sand, shoreId);
  b.add(wall(shore, 0, W.shore.height), IDENTITY, C.stone, shoreId);
  const grass = blob(W.grass.radius, W.outlineLumps, phases, W.outlineSegments);
  const grassId = ids.next();
  b.add(cap(grass, grassTop), IDENTITY, C.leaf, grassId);
  b.add(wall(grass, W.shore.height, grassTop), IDENTITY, C.green, grassId);

  // ---- pond: a sandy rim painted on the grass, then the water with its own outline
  const pondPhases = W.outlineLumps.map(() => rand() * TAU);
  const pondBlob = (radius: number) => blob(radius, W.outlineLumps, pondPhases, 28, W.pond.x, W.pond.z);
  b.add(cap(pondBlob(W.pond.radius * 1.2), grassTop + 0.02, W.pond.x, W.pond.z), IDENTITY, C.sand, grassId);
  b.add(cap(pondBlob(W.pond.radius), grassTop + 0.04, W.pond.x, W.pond.z), IDENTITY, sea.sea, ids.next());

  // ---- the loop: bed, ties and rails
  const trackTop = grassTop + K.height;
  const trackId = ids.next();
  const bedInner = K.radius - K.width / 2;
  const bedOuter = K.radius + K.width / 2;
  b.add(ringCap(bedInner, bedOuter, trackTop, K.segments), IDENTITY, C.stone, trackId);
  b.add(wall(circle(bedOuter, K.segments), grassTop, trackTop), IDENTITY, C.stoneDk, trackId);
  b.add(wall(circle(bedInner, K.segments).reverse(), grassTop, trackTop), IDENTITY, C.stoneDk, trackId);
  for (let i = 0; i < K.ties; i++) {
    b.add(flatQuad(K.tieWidth, K.tieLength), ringFrame(K.radius, (i * 360) / K.ties, trackTop + 0.012), C.stoneDk, trackId);
  }
  for (const side of [-1, 1]) {
    const r = K.radius + (side * K.railGauge) / 2;
    b.add(ringCap(r - K.railWidth / 2, r + K.railWidth / 2, trackTop + 0.024, K.segments), IDENTITY, C.inkSoft, trackId);
  }

  // ---- stations: platform with a yellow edge, a shelter, a sign, and whoever is waiting
  const platformRadius = bedOuter + S.platformGap + S.platformWidth / 2;
  const platformTop = grassTop + S.platformHeight;
  S.anglesDeg.forEach((deg, k) => {
    const frame = ringFrame(platformRadius, deg);
    const at = (x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx) =>
      frame.clone().multiply(place(x, y, z, yaw, sx, sy, sz));
    const line = config.lineColors[(k + 1) % config.lineColors.length]!;

    const platformId = ids.next();
    b.add(new BoxGeometry(S.platformLength, S.platformHeight, S.platformWidth), at(0, grassTop + S.platformHeight / 2, 0), faces(C.paperLo, C.stoneDk), platformId);
    b.add(flatQuad(S.platformLength * 0.97, S.stripWidth), at(0, platformTop + 0.012, -S.platformWidth / 2 + S.stripWidth / 2 + 0.07), C.yellow, platformId);

    const shelterId = ids.next();
    const shelterZ = S.platformWidth / 2 - S.shelterDepth / 2 - 0.1;
    const backZ = shelterZ + S.shelterDepth / 2 - S.postWidth / 2;
    b.add(new BoxGeometry(S.shelterLength, S.roofThickness, S.shelterDepth), at(0, platformTop + S.shelterHeight + S.roofThickness / 2, shelterZ), faces(line, line, C.paperLo), shelterId);
    for (const side of [-1, 1]) {
      b.add(new BoxGeometry(S.postWidth, S.shelterHeight, S.postWidth), at(side * (S.shelterLength / 2 - S.postWidth), platformTop + S.shelterHeight / 2, backZ), C.inkSoft, shelterId);
    }
    b.add(new BoxGeometry(S.shelterLength - S.postWidth * 2, S.shelterHeight * 0.55, 0.12), at(0, platformTop + S.shelterHeight * 0.62, backZ), C.mint, shelterId);

    const signId = ids.next();
    const signX = S.platformLength / 2 - 1.2;
    const signZ = 0.3;
    const boardY = platformTop + S.signPostHeight + S.signHeight / 2;
    b.add(new BoxGeometry(0.24, S.signPostHeight, 0.24), at(signX, platformTop + S.signPostHeight / 2, signZ), C.inkSoft, signId);
    b.add(new BoxGeometry(S.signWidth, S.signHeight, 0.26), at(signX, boardY, signZ), C.paper, signId);
    for (const face of [1, -1]) {
      b.add(wallQuad(S.signWidth * 0.94, S.signHeight * 0.34), at(signX, boardY - S.signHeight * 0.28, signZ + face * 0.145, face > 0 ? 0 : Math.PI), line, signId);
    }

    const riders = S.riders[k] ?? [];
    riders.forEach((colorName, j) => {
      const id = ids.next();
      const x = -S.platformLength * 0.22 + (j - (riders.length - 1) / 2) * 1.05;
      const tall = S.riderHeight;
      b.add(new IcosahedronGeometry(1, 0), at(x, platformTop + tall * 0.33, -0.2, j * 1.3, tall * 0.21, tall * 0.33, tall * 0.21), C[colorName], id);
      b.add(new IcosahedronGeometry(tall * 0.17, 0), at(x, platformTop + tall * 0.8, -0.2, j * 0.7), C.sand, id);
    });
  });

  // ---- tunnel: a stone mouth at each end and a grassy hill over the track between them
  const tunnelFrame = ringFrame(K.radius, U.angleDeg);
  const inTunnel = (x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx) =>
    tunnelFrame.clone().multiply(place(x, y, z, yaw, sx, sy, sz));
  for (const end of [1, -1]) {
    const tunnelId = ids.next();
    const yaw = (end * Math.PI) / 2;
    const frameH = U.portalHeight + 0.4;
    b.add(new BoxGeometry(U.portalDepth, U.height, U.width), inTunnel(end * (U.length - U.portalDepth) / 2, grassTop + U.height / 2, 0), faces(C.paperLo, C.stone), tunnelId);
    b.add(wallQuad(U.portalWidth + 0.8, frameH), inTunnel(end * (U.length / 2 + 0.012), trackTop + frameH / 2, 0, yaw), C.paperLo, tunnelId);
    b.add(wallQuad(U.portalWidth, U.portalHeight), inTunnel(end * (U.length / 2 + 0.024), trackTop + U.portalHeight / 2, 0, yaw), C.inkDeep, tunnelId);
  }
  // Fine enough to read as one round, grassy mound: only its silhouette is inked.
  b.add(upperHalf(new IcosahedronGeometry(1, 2)), inTunnel(0, grassTop, 0, 0, U.hillAlong, U.hillHeight, U.hillAcross), C.leaf, ids.next());

  // ---- clock tower
  const O = W.tower;
  const towerId = ids.next();
  const capWidth = O.width + O.capOverhang * 2;
  b.add(new BoxGeometry(O.width, O.height, O.width), place(O.x, grassTop + O.height / 2, O.z), faces(C.paperLo, C.paper), towerId);
  b.add(new BoxGeometry(capWidth, O.capHeight, capWidth), place(O.x, grassTop + O.height + O.capHeight / 2, O.z), C.paperLo, towerId);
  b.add(new ConeGeometry((capWidth / 2) * Math.SQRT2 * 0.96, O.roofHeight, 4), place(O.x, grassTop + O.height + O.capHeight + O.roofHeight / 2, O.z, Math.PI / 4), C.greenDk, towerId);
  for (let side = 0; side < 4; side++) {
    const turn = place(O.x, 0, O.z, (side * Math.PI) / 2);
    const onWall = (y: number, out: number) => turn.clone().multiply(place(0, grassTop + y, O.width / 2 + out));
    b.add(new CircleGeometry(O.clockRadius, 18), onWall(O.clockY, 0.03), C.yellow, ids.next());
    for (const y of [2.3, 4.7]) b.add(wallQuad(0.75, 1.1), onWall(y, 0.014), C.inkSoft, towerId);
  }

  // ---- brick rowhouses in an arc, doors facing the track
  const H = W.rowhouses;
  const keepOut: { x: number; z: number; r: number }[] = [
    { x: O.x, z: O.z, r: O.width * 0.75 + 1.2 },
    { x: W.pond.x, z: W.pond.z, r: W.pond.radius * 1.25 },
  ];
  for (let i = 0; i < H.count; i++) {
    const deg = mix(H.arcFromDeg, H.arcToDeg, H.count > 1 ? i / (H.count - 1) : 0.5);
    const frame = ringFrame(H.arcRadius, deg);
    const at = (x: number, y: number, z: number, yaw = 0) => frame.clone().multiply(place(x, y, z, yaw));
    const tall = H.heights[i % H.heights.length]!;
    const colorName = H.colors[i % H.colors.length]!;
    const wallColor = C[colorName];
    const glass = colorName === "paperLo" ? C.inkSoft : C.mint;
    const id = ids.next();
    keepOut.push({ x: H.arcRadius * Math.cos(deg * RAD), z: H.arcRadius * Math.sin(deg * RAD), r: H.width * 0.72 + 0.6 });

    b.add(new BoxGeometry(H.width, tall, H.depth), at(0, grassTop + tall / 2, 0), faces(C.stoneDk, wallColor), id);
    if (i % 2 === 0) {
      b.add(gable(H.width + 0.3, H.roofHeight, H.depth + 0.3), at(0, grassTop + tall, 0), (n) => (Math.abs(n.y) < 0.1 ? wallColor : C.inkSoft), id);
    } else {
      b.add(new BoxGeometry(H.width + 0.3, 0.36, H.depth + 0.3), at(0, grassTop + tall + 0.18, 0), faces(C.stoneDk, C.stone), id);
    }
    const floors = Math.max(1, Math.floor((tall - 1.3) / 1.45));
    for (const face of [1, -1]) {
      const yaw = face > 0 ? 0 : Math.PI;
      const z = face * (H.depth / 2 + 0.014);
      for (let floor = 0; floor < floors; floor++) {
        for (const column of [-1, 1]) {
          b.add(wallQuad(0.72, 0.86), at(column * H.width * 0.24, grassTop + 2 + floor * 1.45, z, yaw), glass, id);
        }
      }
    }
    b.add(wallQuad(0.78, 1.3), at(0, grassTop + 0.65, H.depth / 2 + 0.014), C.inkSoft, id);
  }

  // ---- trees: scattered inside the loop and in a band outside it, clear of everything else
  const tunnelAngle = U.angleDeg * RAD;
  const tunnelX = K.radius * Math.cos(tunnelAngle);
  const tunnelZ = K.radius * Math.sin(tunnelAngle);
  const onHill = (x: number, z: number) => {
    const dx = x - tunnelX;
    const dz = z - tunnelZ;
    const across = dx * Math.cos(tunnelAngle) + dz * Math.sin(tunnelAngle);
    const along = -dx * Math.sin(tunnelAngle) + dz * Math.cos(tunnelAngle);
    return (along / (U.length / 2 + 1.4)) ** 2 + (across / (U.hillAcross + 1.2)) ** 2 < 1;
  };
  const stationClearDeg = (S.platformLength / 2 + 2.4) / platformRadius / RAD;
  const trees: World["trees"] = [];
  for (let tries = 0; trees.length < W.trees.count && tries < 8000; tries++) {
    const outside = trees.length % 5 >= 3; // two in every five stand outside the loop
    const deg = rand() * 360;
    const r = outside ? range(W.trees.outerBand[0], W.trees.outerBand[1]) : Math.sqrt(rand()) * W.trees.innerRadius;
    const radius = range(W.trees.canopyRadius[0], W.trees.canopyRadius[1]) * (outside ? 0.72 : 1);
    const x = r * Math.cos(deg * RAD);
    const z = r * Math.sin(deg * RAD);
    if (outside && S.anglesDeg.some((stop) => turnsApart(deg, stop) < stationClearDeg)) continue;
    if (onHill(x, z)) continue;
    if (keepOut.some((k) => Math.hypot(x - k.x, z - k.z) < k.r + radius * 0.5)) continue;
    if (trees.some((t) => Math.hypot(x - t.x, z - t.z) < W.trees.spacing)) continue;
    trees.push({ x, z, radius });
  }
  for (const tree of trees) {
    const id = ids.next();
    const trunkTop = grassTop + W.trees.trunkHeight;
    const tone = rand() < 0.5 ? C.green : C.greenDk;
    b.add(new CylinderGeometry(W.trees.trunkRadius * 0.75, W.trees.trunkRadius, W.trees.trunkHeight, 8), place(tree.x, grassTop + W.trees.trunkHeight / 2, tree.z, rand() * TAU), C.inkSoft, id);
    b.add(new IcosahedronGeometry(tree.radius, 0), placeTurned(tree.x, trunkTop + tree.radius * 0.62, tree.z, rand() * 0.5, rand() * TAU, rand() * 0.5), tone, id);
    if (rand() < 0.45) {
      const a = rand() * TAU;
      const reach = tree.radius * 0.6;
      b.add(new IcosahedronGeometry(tree.radius * 0.62, 0), placeTurned(tree.x + Math.cos(a) * reach, trunkTop + tree.radius * 1.25, tree.z + Math.sin(a) * reach, rand(), rand() * TAU, rand()), tone === C.green ? C.greenDk : C.green, id);
    }
  }

  // ---- rocks along the beach
  for (let i = 0; i < W.rocks.count; i++) {
    const angle = ((i + rand() * 0.7) / W.rocks.count) * TAU;
    const r = lumpyRadius(W.shore.radius, W.outlineLumps, phases, angle) * 0.96;
    const size = range(W.rocks.size[0], W.rocks.size[1]);
    // Never dip below the waterline: there is no water surface to hide the underside.
    const y = Math.max(W.shore.height + size * 0.3, size + 0.02);
    b.add(new IcosahedronGeometry(size, 0), placeTurned(r * Math.cos(angle), y, r * Math.sin(angle), rand(), rand() * TAU, rand()), C.stone, ids.next());
  }

  const island = new Mesh(b.build(), materials.world);
  island.layers.enable(SHADOW_LAYER);
  const group = new Group();
  group.add(island);

  // ---- the trolley
  const cars: Mesh<BufferGeometry>[] = [];
  for (let i = 0; i < T.cars; i++) {
    const car = new Mesh(carGeometry(config, ids.next(), i === 0, i === T.cars - 1), materials.world);
    car.layers.enable(SHADOW_LAYER);
    group.add(car);
    cars.push(car);
  }
  const carY = trackTop + 0.06;
  const carStepDeg = (T.carLength + T.carGap) / K.radius / RAD;
  const timetable = { stopsDeg: S.anglesDeg, legSeconds: T.legSeconds, dwellSeconds: T.dwellSeconds, startSeconds: T.startSeconds };

  // ---- foam on the water: colour only, so id 0 (never inked)
  const foam = new Group();
  const foamLumps: Lumps = [...W.outlineLumps, [13, 0.012]];
  const foamRing = (scale: number, y: number, color: string) => {
    const foamPhases = foamLumps.map(() => rand() * TAU);
    const geometry = new GeoBuilder().add(cap(blob(W.shore.radius * scale, foamLumps, foamPhases, 72), y), IDENTITY, color, 0).build();
    const mesh = new Mesh(geometry, materials.foam);
    mesh.renderOrder = 1;
    foam.add(mesh);
  };
  foamRing(W.foamRing.outer, 0.03, sea.foam2);
  foamRing(W.foamRing.inner, 0.07, sea.foam);

  const update = (seconds: number, foamGrow = 1) => {
    const center = trainCenterDeg(seconds, timetable);
    cars.forEach((car, i) => {
      const a = (center + ((cars.length - 1) / 2 - i) * carStepDeg) * RAD;
      car.position.set(K.radius * Math.cos(a), carY, K.radius * Math.sin(a));
      car.rotation.y = -(a + Math.PI / 2);
    });
    const breathe = 1 + W.foamRing.breathe * Math.sin((TAU * seconds) / W.foamRing.breatheSeconds);
    foam.scale.setScalar(breathe * foamGrow);
  };
  update(0);

  return {
    group,
    island,
    foam,
    cars,
    trees,
    update,
    dispose() {
      island.geometry.dispose();
      for (const car of cars) car.geometry.dispose();
      foam.traverse((o) => (o as Mesh).geometry?.dispose());
    },
  };
}
