/**
 * Every still the phone app uses, as data: what is in it, how big, where the
 * camera stands. `pnpm art` renders them all with the start screen's own
 * pipeline (flat colour, ink lines, wobble) and writes them to
 * apps/phone-web/public/art/<id>.webp, where the app's ArtSlot picks them up.
 */
import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from "three";
import type { Config } from "../config";
import { GeoBuilder, type IdAllocator, place, placeTurned } from "../scene/builder";
import { buildWorld, carGeometry, SHADOW_LAYER, wallQuad, type SceneMaterials } from "../scene/world";
import { PAIR_COLOR_HEX } from "@questline/protocol/colors";
import { figureGeometry, glassesGeometry, type FigurePose, type FigureLook } from "./models";

export interface StudioContext {
  config: Config;
  ids: IdAllocator;
  materials: SceneMaterials;
}

export interface Subject {
  root: Object3D;
  /** The ball the camera frames. */
  center: Vector3;
  radius: number;
}

export interface Shot {
  /** The ArtSlot id, and the file name. */
  id: string;
  /** Size it is drawn for, in CSS pixels. The file is `scale` times that. */
  width: number;
  height: number;
  scale: number;
  /** "clear": transparent, sits on any screen. "sea": the daytime sea behind it, like a photo. */
  background: "clear" | "sea";
  camera: { azimuthDeg: number; elevationDeg: number; fovDeg: number; /** 1 = subject just fits. */ fill: number };
  build(ctx: StudioContext): Subject;
}

function solid(geometry: BufferGeometry, ctx: StudioContext): Mesh {
  const mesh = new Mesh(geometry, ctx.materials.world);
  mesh.layers.enable(SHADOW_LAYER);
  return mesh;
}

/** A soft-edged hard shadow on the ground under a subject with no ground of its own. */
function groundShadow(ctx: StudioContext, rx: number, rz: number, x = 0, z = 0): Mesh {
  const disc = new CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  const geometry = new GeoBuilder().add(disc, place(x, 0.004, z, 0, rx, 1, rz), ctx.config.colors.shadow, 0).build();
  const mesh = new Mesh(geometry, ctx.materials.dropShadow);
  mesh.renderOrder = 2;
  return mesh;
}

const group = (...children: Object3D[]) => {
  const g = new Group();
  g.add(...children);
  return g;
};

// ---------------------------------------------------------------- shots

const hero: Shot = {
  id: "hero-art",
  width: 360,
  height: 290,
  scale: 3,
  background: "clear",
  camera: { azimuthDeg: 24, elevationDeg: 31, fovDeg: 30, fill: 1.2 },
  build(ctx) {
    const world = buildWorld(ctx.config, ctx.config.seas.Day, ctx.ids, ctx.materials);
    world.update(3.2);
    return { root: world.group, center: new Vector3(0, 3.5, 0), radius: 33 };
  },
};

const rider: Shot = {
  id: "ride-rider",
  width: 100,
  height: 110,
  scale: 3,
  background: "clear",
  camera: { azimuthDeg: 18, elevationDeg: 9, fovDeg: 20, fill: 1.12 },
  build(ctx) {
    const C = ctx.config.colors;
    const figure = solid(figureGeometry({ shirt: C.orange, hair: C.inkSoft, badge: C.paper }, C, ctx.ids), ctx);
    return { root: group(figure, groundShadow(ctx, 0.36, 0.2, 0.08, -0.06)), center: new Vector3(0, 0.5, 0), radius: 0.56 };
  },
};

const glasses: Shot = {
  id: "glasses-art",
  width: 340,
  height: 210,
  scale: 3,
  background: "clear",
  camera: { azimuthDeg: 26, elevationDeg: 16, fovDeg: 24, fill: 1.3 },
  build(ctx) {
    const mesh = solid(glassesGeometry(ctx.config.colors, ctx.ids), ctx);
    mesh.position.y = 0.48;
    return { root: group(mesh, groundShadow(ctx, 1.5, 0.75, 0.25, -0.75)), center: new Vector3(0, 0.45, -0.5), radius: 1.75 };
  },
};

/** Side view of the trolley in a line's colour, for the app's train scenes. */
const trolley = (line: string, hex: string): Shot => ({
  id: `sprite-trolley-${line}`,
  width: 336,
  height: 84,
  scale: 3,
  background: "clear",
  camera: { azimuthDeg: 0, elevationDeg: 4, fovDeg: 12, fill: 3.55 },
  build(ctx) {
    const T = ctx.config.train;
    const step = T.carLength + T.carGap;
    const lead = solid(carGeometry(ctx.config, ctx.ids.next(), true, false, hex), ctx);
    const tail = solid(carGeometry(ctx.config, ctx.ids.next(), false, true, hex), ctx);
    lead.position.x = step / 2;
    tail.position.x = -step / 2;
    return {
      root: group(lead, tail, groundShadow(ctx, step + 0.5, T.carWidth * 0.42, 0.3, -0.4)),
      center: new Vector3(0, T.carHeight * 0.44, 0),
      radius: step + 0.4,
    };
  },
});

/** A round tree and two little houses, for the app's platform scenes. */
const tree: Shot = {
  id: "sprite-tree",
  width: 72,
  height: 84,
  scale: 3,
  background: "clear",
  camera: { azimuthDeg: 20, elevationDeg: 10, fovDeg: 18, fill: 1.05 },
  build(ctx) {
    const C = ctx.config.colors;
    const id = ctx.ids.next();
    const b = new GeoBuilder()
      .add(new CylinderGeometry(0.2, 0.26, 1, 8), place(0, 0.5, 0), C.inkSoft, id)
      .add(new IcosahedronGeometry(1, 0), placeTurned(0, 1.75, 0, 0.3, 0.6, 0.2), C.green, id)
      .add(new IcosahedronGeometry(0.6, 0), placeTurned(0.55, 2.35, 0.2, 0.5, 1.2, 0.1), C.greenDk, id);
    return { root: group(solid(b.build(), ctx), groundShadow(ctx, 1, 0.5, 0.3, -0.2)), center: new Vector3(0.1, 1.45, 0), radius: 1.75 };
  },
};

const house = (id: string, roof: string): Shot => ({
  id,
  width: 72,
  height: 84,
  scale: 3,
  background: "clear",
  camera: { azimuthDeg: 28, elevationDeg: 14, fovDeg: 18, fill: 1.05 },
  build(ctx) {
    const C = ctx.config.colors;
    const oid = ctx.ids.next();
    const b = new GeoBuilder()
      .add(new BoxGeometry(2, 2.2, 1.8), place(0, 1.1, 0), C.paper, oid)
      .add(new BoxGeometry(2.4, 0.5, 2.2), place(0, 2.45, 0), roof, oid)
      .add(wallQuad(0.5, 0.95), place(-0.35, 0.48, 0.914), C.ink, oid)
      .add(wallQuad(0.45, 0.45), place(0.5, 1.3, 0.914), C.inkSoft, oid);
    return { root: group(solid(b.build(), ctx), groundShadow(ctx, 1.5, 0.9, 0.35, -0.3)), center: new Vector3(0, 1.3, 0), radius: 1.95 };
  },
});

// ---------------------------------------------------------------- celebrations
// The stamp and recap screens: you and your match, cheering or high-fiving, on a slice
// of platform. You wear orange; your match wears their pair colour (blue if that is
// orange too). Separate sprites so the app can move each one.

/** Pair colours a match can wear. Orange is yours, so a match in an orange pair wears blue. */
export const FRIEND_COLORS = ["green", "blue", "pink", "yellow", "purple"] as const;

const posedRider = (id: string, look: (C: Config["colors"]) => FigureLook, pose: FigurePose, yawDeg: number): Shot => ({
  id,
  width: 110,
  height: 140,
  scale: 3,
  background: "clear",
  camera: { azimuthDeg: 8, elevationDeg: 7, fovDeg: 20, fill: 1 },
  build(ctx) {
    const figure = solid(figureGeometry(look(ctx.config.colors), ctx.config.colors, ctx.ids, pose), ctx);
    figure.rotation.y = (yawDeg * Math.PI) / 180;
    return { root: group(figure, groundShadow(ctx, 0.34, 0.18, 0.06, -0.05)), center: new Vector3(0, 0.56, 0), radius: 0.62 };
  },
});

const you = (C: Config["colors"]): FigureLook => ({ shirt: C.orange, hair: C.inkSoft, badge: C.paper });
const friend = (hex: string) => (C: Config["colors"]): FigureLook => ({ shirt: hex, hair: C.inkDeep, badge: C.paper });

const celebrations: Shot[] = [
  posedRider("cheer-you", you, { arms: [150, 158] }, 6),
  ...FRIEND_COLORS.map((c) => posedRider(`cheer-friend-${c}`, friend(PAIR_COLOR_HEX[c]), { arms: [160, 145] }, -6)),
  // Turned towards each other, the inner hand up for the high five.
  posedRider("highfive-you", you, { arms: [14, 152] }, 42),
  ...FRIEND_COLORS.map((c) => posedRider(`highfive-friend-${c}`, friend(PAIR_COLOR_HEX[c]), { arms: [152, 14] }, -42)),
];

/** A short slice of platform, yellow edge at the front, for the riders to stand on. */
function platformSlice(ctx: StudioContext, length: number, depth: number) {
  const C = ctx.config.colors;
  const id = ctx.ids.next();
  return new GeoBuilder()
    .add(new BoxGeometry(length, 0.6, depth), place(0, 0.3, 0), (n) => (n.y > 0.5 ? C.paperLo : C.stoneDk), id)
    .add(new BoxGeometry(length * 0.98, 0.012, 0.45), place(0, 0.606, depth / 2 - 0.3), C.yellow, id)
    .build();
}

const stage: Shot = {
  id: "stage-platform",
  width: 340,
  height: 64,
  scale: 3,
  background: "clear",
  // Framed by its height (the narrow side), so the slice runs nearly edge to edge.
  camera: { azimuthDeg: 0, elevationDeg: 14, fovDeg: 16, fill: 1 },
  build(ctx) {
    return { root: solid(platformSlice(ctx, 8, 2.2), ctx), center: new Vector3(0, 0.32, 0), radius: 0.86 };
  },
};

/** The platform with the trolley standing behind it: the recap screen's backdrop. */
const recapBackdrop: Shot = {
  id: "recap-backdrop",
  width: 360,
  height: 190,
  scale: 3,
  background: "clear",
  camera: { azimuthDeg: 0, elevationDeg: 9, fovDeg: 22, fill: 1.62 },
  build(ctx) {
    const T = ctx.config.train;
    const step = T.carLength + T.carGap;
    const lead = solid(carGeometry(ctx.config, ctx.ids.next(), true, false), ctx);
    const tail = solid(carGeometry(ctx.config, ctx.ids.next(), false, true), ctx);
    lead.position.set(step / 2 - 1.6, 0, -2.9);
    tail.position.set(-step / 2 - 1.6, 0, -2.9);
    const platform = solid(platformSlice(ctx, 12, 3), ctx);
    platform.position.y = 0;
    return { root: group(lead, tail, platform), center: new Vector3(0, 1.6, -1.2), radius: 6.4 };
  },
};

import { CONFIG } from "../config";

export const SHOTS: Shot[] = [
  hero,
  rider,
  glasses,
  ...["green", "red", "orange", "blue"].map((line, i) => trolley(line, CONFIG.lineColors[i]!)),
  tree,
  house("sprite-house-pink", "#c9a9a6"),
  house("sprite-house-red", "#d9604a"),
  ...celebrations,
  stage,
  recapBackdrop,
];
