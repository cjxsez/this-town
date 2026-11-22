/**
 * The little world behind the title: an island in the sea with a trolley loop.
 *
 * - shore and grass, and a little Boston University inside the loop: the stacked
 *   CDS building, Warren Towers, Marsh Chapel, Bay State Road brownstones
 * - trees in greens and autumn colours, and rocks along the beach
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
  Vector3,
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
  /** Where the trees ended up and their leaf colour (for tests and debugging). */
  trees: { x: number; z: number; radius: number; tone: string }[];
  /** Circles the buildings stand in. Trees keep out of them. */
  keepOut: { name: string; x: number; z: number; r: number }[];
  /** The CDS building: the height of its roof, and the id of each stacked block. */
  cds: { top: number; blockIds: number[] };
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
export const faces =
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
export const flatQuad = (sx: number, sz: number) => new PlaneGeometry(sx, sz).rotateX(-Math.PI / 2);
/** A rectangle standing up, facing +Z. */
export const wallQuad = (w: number, h: number) => new PlaneGeometry(w, h);

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
export function ringFrame(radius: number, deg: number, y = 0): Matrix4 {
  const a = deg * RAD;
  return place(radius * Math.cos(a), y, radius * Math.sin(a), Math.PI / 2 - a);
}

export function carGeometry(config: Config, id: number, lead: boolean, tail: boolean, stripe: string = config.lineColors[0]): BufferGeometry {
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
    b.add(wallQuad(L * 0.985, T.stripeHeight), place(0, stripeY, z, yaw), stripe, id);
    for (let k = 0; k < T.windows; k++) {
      b.add(wallQuad(bay * 0.72, windowH), place((k - (T.windows - 1) / 2) * bay, windowY, z, yaw), C.inkSoft, id);
    }
  }
  for (const end of [1, -1]) {
    const yaw = (end * Math.PI) / 2;
    const x = end * (L / 2 + proud);
    b.add(wallQuad(wide * 0.985, T.stripeHeight), place(x, stripeY, 0, yaw), stripe, id);
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

export interface WorldOptions {
  /** Stripe colour of the trolley. Default: the first line colour (Green Line). */
  trainStripe?: string;
  /** Where the train stops, if not at every station. One stop sends it right round the loop each time. */
  stopsDeg?: readonly number[];
}

export function buildWorld(
  config: Config,
  sea: SeaColors,
  ids: IdAllocator,
  materials: SceneMaterials,
  options: WorldOptions = {},
): World {
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

  // ---- the CDS building: a wide base and a stack of blocks pushed alternately each way
  const D = W.cds;
  const proud = 0.014;
  /** Places a flat detail on one of the four walls of a box: `u` along the wall, `v` up from its middle. */
  const onWalls = (frame: Matrix4, w: number, d: number, y: number) => (side: number, u: number, v: number, lift = 1, lean = 0) => {
    const out = proud * lift;
    const spot =
      side === 0 ? place(u, y + v, d / 2 + out)
      : side === 1 ? place(-u, y + v, -d / 2 - out, Math.PI)
      : side === 2 ? place(w / 2 + out, y + v, -u, Math.PI / 2)
      : place(-w / 2 - out, y + v, u, -Math.PI / 2);
    return frame.clone().multiply(spot).multiply(placeTurned(0, 0, 0, 0, 0, lean));
  };
  /** Evenly spaced upright strips across a wall `span` wide. */
  const strips = (span: number, every: number) => {
    const count = Math.max(1, Math.round(span / every));
    return Array.from({ length: count }, (_, i) => (i + 0.5 - count / 2) * (span / count));
  };
  const keepOut: World["keepOut"] = [];
  const cdsFrame = place(D.x, 0, D.z, D.yawDeg * RAD);
  const cdsAt = (x: number, z: number) => cdsFrame.clone().multiply(place(x, 0, z));
  {
    // Base: dark glass with slanted brown bracing, a brown band round the roof and a green roof.
    const P = D.podium;
    const id = ids.next();
    const frame = cdsAt(P.dx, 0);
    const wallsOf = onWalls(frame, P.w, P.d, grassTop + P.h / 2);
    b.add(new BoxGeometry(P.w, P.h, P.d), frame.clone().multiply(place(0, grassTop + P.h / 2, 0)), faces(C.paperLo, C.glassDk), id);
    for (let side = 0; side < 4; side++) {
      const span = side < 2 ? P.w : P.d;
      for (const u of strips(span - 1.6, 1.15)) b.add(wallQuad(0.16, P.h * 0.98), wallsOf(side, u, -0.1, 1, 0.42), C.cdsFin, id);
    }
    b.add(new BoxGeometry(P.w + 0.3, 0.4, P.d + 0.3), frame.clone().multiply(place(0, grassTop + P.h - 0.2, 0)), faces(C.paperLo, C.cdsFin), id);
    b.add(flatQuad(P.w * 0.34, P.d * 0.62), frame.clone().multiply(place(P.w * 0.27, grassTop + P.h + proud, 0)), C.leaf, id);
    for (const end of [-1, 1]) {
      const c = new Vector3(P.dx + end * P.w * 0.27, 0, 0).applyMatrix4(cdsFrame);
      keepOut.push({ name: "cds base", x: c.x, z: c.z, r: 5 });
    }
  }
  const blockIds: number[] = [];
  let cdsY = grassTop + D.podium.h;
  D.blocks.forEach((block, n) => {
    const id = ids.next();
    blockIds.push(id);
    const frame = cdsAt(block.dx, block.dz);
    const mid = cdsY + block.h / 2;
    const wallsOf = onWalls(frame, block.w, block.d, mid);
    const last = n === D.blocks.length - 1;
    if (block.kind === "glass") {
      // A recessed band of glass with thin mullions.
      b.add(new BoxGeometry(block.w, block.h, block.d), frame.clone().multiply(place(0, mid, 0)), faces(C.paperLo, C.glass, C.glassDk), id);
      for (let side = 0; side < 4; side++) {
        const span = side < 2 ? block.w : block.d;
        for (const u of strips(span, 0.95)) b.add(wallQuad(0.07, block.h), wallsOf(side, u, 0), C.glassDk, id);
      }
    } else {
      // A louvered block: brown fins on every wall, over brown on two walls and over glass on the other two.
      // Which pair is glass swaps from block to block, so every view shows both.
      b.add(new BoxGeometry(block.w, block.h, block.d), frame.clone().multiply(place(0, mid, 0)), faces(C.paperLo, C.cdsFin, C.cdsFinDk), id);
      const glassOnZ = n % 2 === 0;
      for (let side = 0; side < 4; side++) {
        const span = side < 2 ? block.w : block.d;
        const glassy = side < 2 === glassOnZ;
        if (glassy) b.add(wallQuad(span - 0.34, block.h - 0.34), wallsOf(side, 0, 0), C.glass, id);
        for (const u of strips(span - 0.3, D.finEvery)) {
          b.add(wallQuad(glassy ? D.glassFinWidth : D.finWidth, block.h - (glassy ? 0.34 : 0.2)), wallsOf(side, u, 0, 2), glassy ? C.cdsFin : C.cdsFinDk, id);
        }
        // A dark line where the floors meet, across the glass.
        if (glassy) b.add(wallQuad(span - 0.34, 0.09), wallsOf(side, 0, 0, 3), C.glassDk, id);
      }
      if (last) {
        // The top block's glass corner.
        const cornerH = block.h * 0.62;
        b.add(wallQuad(block.w * 0.42, cornerH), wallsOf(0, block.w * 0.27, (block.h - cornerH) / 2 - 0.12, 3), C.glass, id);
        b.add(wallQuad(block.d * 0.42, cornerH), wallsOf(2, -block.d * 0.27, (block.h - cornerH) / 2 - 0.12, 3), C.glass, id);
        b.add(new BoxGeometry(2.2, 0.55, 1.8), frame.clone().multiply(place(-1, cdsY + block.h + 0.275, -0.8)), faces(C.paperLo, C.stone), id);
      }
    }
    cdsY += block.h;
  });
  keepOut.push({ name: "cds tower", x: D.x, z: D.z, r: 5.6 });

  // ---- Warren Towers: three slabs with window strips, on one long base
  {
    const N = W.warren;
    const frame = place(N.x, 0, N.z, N.yawDeg * RAD);
    const baseId = ids.next();
    b.add(new BoxGeometry(N.baseW, N.baseH, N.baseD), frame.clone().multiply(place(0, grassTop + N.baseH / 2, 0)), faces(C.paperLo, C.limestoneDk), baseId);
    const baseWalls = onWalls(frame, N.baseW, N.baseD, grassTop + N.baseH / 2);
    for (const side of [0, 1]) b.add(wallQuad(N.baseW - 1, N.baseH * 0.36), baseWalls(side, 0, 0.1), C.inkSoft, baseId);
    for (let i = 0; i < N.towers; i++) {
      const id = ids.next();
      const x = (i - (N.towers - 1) / 2) * N.towerGap;
      const tower = frame.clone().multiply(place(x, 0, 0));
      const mid = grassTop + N.baseH + N.towerH / 2;
      b.add(new BoxGeometry(N.towerW, N.towerH, N.towerD), tower.clone().multiply(place(0, mid, 0)), faces(C.paperLo, C.limestone), id);
      const walls = onWalls(tower, N.towerW, N.towerD, mid);
      for (let side = 0; side < 4; side++) {
        const span = side < 2 ? N.towerW : N.towerD;
        for (const u of strips(span - 0.7, 0.95)) b.add(wallQuad(0.3, N.towerH - 1.1), walls(side, u, -0.1), C.inkSoft, id);
      }
      const c = new Vector3(x, 0, 0).applyMatrix4(frame);
      keepOut.push({ name: "warren towers", x: c.x, z: c.z, r: 4.2 });
    }
  }

  // ---- Marsh Chapel: the nave between two pointed towers, a wing either side
  {
    const M = W.marsh;
    const frame = place(M.x, 0, M.z, M.yawDeg * RAD);
    const at = (x: number, y: number, z: number, yaw = 0) => frame.clone().multiply(place(x, y, z, yaw));
    const nave = ids.next();
    b.add(new BoxGeometry(M.naveW, M.naveH, M.naveD), at(0, grassTop + M.naveH / 2, 0), C.limestone, nave);
    // Roof ridge runs front to back: the gable (built along X) is turned a quarter.
    b.add(gable(M.naveD + 0.3, M.roofH, M.naveW + 0.3), at(0, grassTop + M.naveH, 0, Math.PI / 2), (n) => (Math.abs(n.y) < 0.1 ? C.limestone : C.inkSoft), nave);
    b.add(wallQuad(0.9, 1.7), at(0, grassTop + 0.85, M.naveD / 2 + proud), C.inkSoft, nave);
    b.add(new CircleGeometry(0.55, 14), at(0, grassTop + M.naveH + 0.1, M.naveD / 2 + proud), C.glass, ids.next());
    const towerX = M.naveW / 2 + M.towerW / 2 + 0.5;
    for (const s of [-1, 1]) {
      const id = ids.next();
      b.add(new BoxGeometry(M.towerW, M.towerH, M.towerW), at(s * towerX, grassTop + M.towerH / 2, M.naveD / 2 - M.towerW / 2), C.limestone, id);
      b.add(new ConeGeometry((M.towerW / 2) * Math.SQRT2 * 0.98, M.spireH, 4), at(s * towerX, grassTop + M.towerH + M.spireH / 2, M.naveD / 2 - M.towerW / 2, Math.PI / 4), C.limestoneDk, id);
      for (const y of [M.towerH * 0.45, M.towerH * 0.78]) {
        b.add(wallQuad(0.5, 1.1), at(s * towerX, grassTop + y, M.naveD / 2 + proud), C.inkSoft, id);
      }
      // Wing with tall arched windows.
      const wing = ids.next();
      const wingX = towerX + M.towerW / 2 + M.wingW / 2;
      b.add(new BoxGeometry(M.wingW, M.wingH, M.wingD), at(s * wingX, grassTop + M.wingH / 2, M.naveD / 2 - M.wingD / 2), faces(C.limestoneDk, C.limestone), wing);
      for (const u of strips(M.wingW - 0.6, 0.85)) {
        b.add(wallQuad(0.4, M.wingH * 0.6), at(s * wingX + u, grassTop + M.wingH * 0.5, M.naveD / 2 + proud), C.inkSoft, wing);
      }
      for (const x of [towerX, wingX]) {
        const c = new Vector3(s * x, 0, M.naveD / 2 - 1.4).applyMatrix4(frame);
        keepOut.push({ name: "marsh chapel", x: c.x, z: c.z, r: 3.1 });
      }
    }
    const c = new Vector3(0, 0, 0).applyMatrix4(frame);
    keepOut.push({ name: "marsh chapel", x: c.x, z: c.z, r: 3.6 });
  }

  // ---- Bay State Road brownstones in an arc, doors facing the track
  const H = W.brownstones;
  for (let i = 0; i < H.count; i++) {
    const deg = mix(H.arcFromDeg, H.arcToDeg, H.count > 1 ? i / (H.count - 1) : 0.5);
    const frame = ringFrame(H.arcRadius, deg);
    const at = (x: number, y: number, z: number, yaw = 0) => frame.clone().multiply(place(x, y, z, yaw));
    const tall = H.heights[i % H.heights.length]!;
    const colorName = H.colors[i % H.colors.length]!;
    const wallColor = C[colorName];
    const glass = C.mint;
    const id = ids.next();
    keepOut.push({ name: "brownstone", x: H.arcRadius * Math.cos(deg * RAD), z: H.arcRadius * Math.sin(deg * RAD), r: H.width * 0.72 + 0.6 });

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
    const tone = C[W.trees.tones[Math.floor(rand() * W.trees.tones.length)]!];
    trees.push({ x, z, radius, tone });
  }
  for (const tree of trees) {
    const id = ids.next();
    const trunkTop = grassTop + W.trees.trunkHeight;
    const { tone } = tree;
    // The smaller second blob is a shade away: darker on greens, lighter on autumn colours.
    const second = tone === C.green ? C.greenDk : tone === C.greenDk ? C.green : tone === C.leafDk ? C.green : tone === C.yellow ? C.orange : tone === C.orange ? C.yellow : C.orange;
    b.add(new CylinderGeometry(W.trees.trunkRadius * 0.75, W.trees.trunkRadius, W.trees.trunkHeight, 8), place(tree.x, grassTop + W.trees.trunkHeight / 2, tree.z, rand() * TAU), C.inkSoft, id);
    b.add(new IcosahedronGeometry(tree.radius, 0), placeTurned(tree.x, trunkTop + tree.radius * 0.62, tree.z, rand() * 0.5, rand() * TAU, rand() * 0.5), tone, id);
    if (rand() < 0.45) {
      const a = rand() * TAU;
      const reach = tree.radius * 0.6;
      b.add(new IcosahedronGeometry(tree.radius * 0.62, 0), placeTurned(tree.x + Math.cos(a) * reach, trunkTop + tree.radius * 1.25, tree.z + Math.sin(a) * reach, rand(), rand() * TAU, rand()), second, id);
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
    const car = new Mesh(carGeometry(config, ids.next(), i === 0, i === T.cars - 1, options.trainStripe), materials.world);
    car.layers.enable(SHADOW_LAYER);
    group.add(car);
    cars.push(car);
  }
  const carY = trackTop + 0.06;
  const carStepDeg = (T.carLength + T.carGap) / K.radius / RAD;
  const timetable = { stopsDeg: options.stopsDeg ?? S.anglesDeg, legSeconds: T.legSeconds, dwellSeconds: T.dwellSeconds, startSeconds: T.startSeconds };

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
    keepOut,
    cds: { top: cdsY, blockIds },
    update,
    dispose() {
      island.geometry.dispose();
      for (const car of cars) car.geometry.dispose();
      foam.traverse((o) => (o as Mesh).geometry?.dispose());
    },
  };
}
