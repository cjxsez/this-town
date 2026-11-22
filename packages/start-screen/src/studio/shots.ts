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
import { buildWorld, carGeometry, ringFrame, SHADOW_LAYER, wallQuad, type SceneMaterials } from "../scene/world";
import { ANIMALS, animalGeometry, figureGeometry, glassesGeometry, SPOTS, spotGeometry, type FigureLook } from "./models";

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

const RAD = Math.PI / 180;

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

const animals: Shot[] = ANIMALS.map((animal) => ({
  id: `animal-${animal}`,
  width: 96,
  height: 96,
  scale: 3,
  background: "clear" as const,
  camera: { azimuthDeg: 12, elevationDeg: 4, fovDeg: 18, fill: 1 },
  build(ctx) {
    const geometry = animalGeometry(animal, ctx.config.colors, ctx.ids);
    geometry.computeBoundingSphere();
    const ball = geometry.boundingSphere!;
    return { root: solid(geometry, ctx), center: ball.center.clone(), radius: ball.radius * 0.94 };
  },
}));

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

const spots: Shot[] = SPOTS.map((spot) => ({
  id: `meet-spot-kenmore-${spot}`,
  width: 330,
  height: 170,
  scale: 3,
  background: "clear" as const,
  camera: { azimuthDeg: spot === "comm-ave-stairs" ? 30 : 22, elevationDeg: 17, fovDeg: 26, fill: 1.5 },
  build(ctx) {
    return { root: solid(spotGeometry(spot, ctx.config, ctx.ids), ctx), center: new Vector3(0, 1.7, 0), radius: 5.4 };
  },
}));

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

/** A snapshot of two riders on a platform, the trolley in behind them. */
function snapshot(id: string, station: number, swing: number, looks: [FigureLook, FigureLook]): Shot {
  return {
    id,
    width: 320,
    height: 240,
    scale: 3,
    background: "sea",
    camera: { azimuthDeg: 0, elevationDeg: 13, fovDeg: 34, fill: 0.92 },
    build(ctx) {
      // The island without its tiny waiting riders: the two in the photo are the people here.
      const stations = { ...ctx.config.world.stations, riders: [[], [], []] };
      const config = { ...ctx.config, world: { ...ctx.config.world, stations } } as unknown as Config;
      const W = config.world;
      const S = W.stations;
      const T = config.train;
      const world = buildWorld(config, config.seas.Day, ctx.ids, ctx.materials);
      // Hold the train at this stop.
      world.update(station * (T.legSeconds + T.dwellSeconds) + T.dwellSeconds / 2 - T.startSeconds);

      const deg = S.anglesDeg[station]!;
      const platformRadius = W.track.radius + W.track.width / 2 + S.platformGap + S.platformWidth / 2;
      const platformTop = W.grass.top + S.platformHeight;
      const frame = ringFrame(platformRadius, deg);
      const tall = 2.5;
      const standX = S.platformLength * 0.31;
      const root = group(world.group, world.foam);
      looks.forEach((look, i) => {
        const side = i === 0 ? -1 : 1;
        const figure = solid(figureGeometry(look, config.colors, ctx.ids), ctx);
        figure.applyMatrix4(frame.clone().multiply(place(standX + side * 0.85, platformTop, 0.75, -side * 14 * RAD, tall)));
        root.add(figure);
      });
      const center = new Vector3(standX, platformTop + tall * 0.62, 0.75).applyMatrix4(frame);
      // Stand outside the loop, looking in at the platform.
      this.camera.azimuthDeg = 90 - deg + swing;
      return { root, center, radius: 3.1 };
    },
  };
}

export function snapshots(C: Config["colors"]): Shot[] {
  const you: FigureLook = { shirt: C.orange, hair: C.inkSoft, badge: C.paper };
  return [
    snapshot("memory-photo", 0, 16, [you, { shirt: "#17736f", hair: C.brick, badge: C.paper }]),
    snapshot("memory-m-jo", 1, -18, [you, { shirt: C.yellow, hair: C.inkDeep, badge: C.paper }]),
    snapshot("memory-m-dev", 2, 20, [you, { shirt: C.blue, hair: C.inkSoft, badge: C.paper }]),
    snapshot("memory-m-ravi", 0, -22, [you, { shirt: C.red, hair: C.inkDeep, badge: C.paper }]),
  ];
}

import { CONFIG } from "../config";

export const SHOTS: Shot[] = [
  hero,
  rider,
  glasses,
  ...spots,
  ...animals,
  ...["green", "red", "orange", "blue"].map((line, i) => trolley(line, CONFIG.lineColors[i]!)),
  tree,
  house("sprite-house-pink", "#c9a9a6"),
  house("sprite-house-red", "#d9604a"),
  ...snapshots(CONFIG.colors),
];
