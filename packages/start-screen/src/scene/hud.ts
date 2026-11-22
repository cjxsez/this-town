/**
 * The title tiles and the BEGIN button. They are parented to the camera, so they
 * stay centred and upright while the island turns behind them.
 *
 * Each piece is a chunky rounded slab with slightly different corners (the app's
 * wobbly --r1..--r4 corner sets), a letter printed on its front, and a hard drop
 * shadow behind it like the app's cards. Tile backs are the four line colours, so
 * a flipping title flashes green, red, orange and blue.
 */
import { ExtrudeGeometry, Group, Matrix4, Mesh, Shape, ShapeGeometry, type BufferGeometry } from "three";
import type { Config } from "../config";
import { mix } from "../core/ease";
import type { HudLayout } from "../core/layout";
import { mulberry32 } from "../core/rng";
import { GeoBuilder, type IdAllocator, type Paint } from "./builder";
import type { SceneMaterials } from "./world";

/** Where each letter (and "label", the button text) lives in the glyph texture. */
export interface AtlasRects {
  rect(key: string): { u0: number; v0: number; u1: number; v1: number };
}

export interface PieceView {
  mesh: Mesh<BufferGeometry>;
  shadow: Mesh<BufferGeometry>;
  /** Resting place on the title plane, world units from its middle. */
  home: { x: number; y: number };
  /** World size of one unit of this piece: a tile's width, the button's height. */
  size: number;
}

export interface TileView extends PieceView {
  /** Resting rotation, radians. */
  rest: { pitch: number; yaw: number; roll: number };
  /** A round T roundel rather than a square tile. */
  roundel: boolean;
}

export interface TilePose {
  dy: number;
  dz: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
}
export type ButtonPose = Omit<TilePose, "rotY">;

export interface Hud {
  group: Group;
  tiles: TileView[];
  button: PieceView;
  setLayout(layout: HudLayout, unitsPerPx: number): void;
  poseTile(index: number, pose: TilePose): void;
  poseButton(pose: ButtonPose): void;
  dispose(): void;
}

const RAD = Math.PI / 180;
const IDENTITY = new Matrix4();
/** Rounded corners are drawn with this many segments: fine enough to stay un-inked. */
const CURVE_SEGMENTS = 5;
/** A full circle needs more. */
const CIRCLE_SEGMENTS = 40;

function circle(diameter: number): Shape {
  const shape = new Shape();
  shape.absarc(0, 0, diameter / 2, 0, Math.PI * 2, false);
  return shape;
}

/** `corners` are top-left, top-right, bottom-right, bottom-left radii (CSS order). */
function roundedRect(w: number, h: number, corners: readonly number[]): Shape {
  const [tl = 0, tr = 0, br = 0, bl = 0] = corners;
  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -h / 2;
  const y1 = h / 2;
  const shape = new Shape();
  shape.moveTo(x0 + bl, y0);
  shape.lineTo(x1 - br, y0);
  shape.absarc(x1 - br, y0 + br, br, -Math.PI / 2, 0, false);
  shape.lineTo(x1, y1 - tr);
  shape.absarc(x1 - tr, y1 - tr, tr, 0, Math.PI / 2, false);
  shape.lineTo(x0 + tl, y1);
  shape.absarc(x0 + tl, y1 - tl, tl, Math.PI / 2, Math.PI, false);
  shape.lineTo(x0, y0 + bl);
  shape.absarc(x0 + bl, y0 + bl, bl, Math.PI, Math.PI * 1.5, false);
  return shape;
}

/** A slab centred on the origin, front at +Z, with its front face mapped to `rect` of the glyph texture. */
function slab(
  shape: Shape,
  w: number,
  h: number,
  depth: number,
  paint: Paint,
  id: number,
  rect: ReturnType<AtlasRects["rect"]>,
  curveSegments = CURVE_SEGMENTS,
): BufferGeometry {
  const solid = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments });
  solid.translate(0, 0, -depth / 2);
  const geometry = new GeoBuilder()
    .add(solid, IDENTITY, paint, id, (n, p) =>
      n.z > 0.5 ? [mix(rect.u0, rect.u1, (p.x + w / 2) / w), mix(rect.v0, rect.v1, (p.y + h / 2) / h)] : null,
    )
    .build();
  solid.dispose();
  return geometry;
}

function dropShadow(
  shape: Shape,
  color: string,
  material: SceneMaterials["dropShadow"],
  curveSegments = CURVE_SEGMENTS,
): Mesh<BufferGeometry> {
  const flat = new ShapeGeometry(shape, curveSegments);
  const mesh = new Mesh(new GeoBuilder().add(flat, IDENTITY, color, 0).build(), material);
  flat.dispose();
  mesh.renderOrder = 2;
  return mesh;
}

export function buildHud(
  chars: string[],
  /** Which tiles are roundels (see core/layout.ts roundelMask). */
  roundels: readonly boolean[],
  config: Config,
  ids: IdAllocator,
  atlas: AtlasRects,
  materials: SceneMaterials,
): Hud {
  const T = config.hud.title;
  const B = config.hud.button;
  const D = config.hud.dropShadow;
  const C = config.colors;
  const group = new Group();
  const rand = mulberry32(T.seed);
  const jitter = (deg: number) => (rand() * 2 - 1) * deg * RAD;

  const R = config.hud.roundel;
  const tiles: TileView[] = chars.map((char, index) => {
    const rest = { pitch: T.restPitchDeg * RAD, yaw: jitter(T.restYawDeg), roll: jitter(T.restRollDeg) };
    const id = ids.next();
    if (roundels[index]) {
      const shape = circle(R.diameter);
      const paint: Paint = (n) => (n.z > 0.5 ? C[R.face] : n.z < -0.5 ? C[R.back] : C[R.side]);
      const geometry = slab(shape, R.diameter, R.diameter, T.depth, paint, id, atlas.rect(`roundel:${char}`), CIRCLE_SEGMENTS);
      const mesh = new Mesh(geometry, materials.hud);
      const shadow = dropShadow(shape, C.shadow, materials.dropShadow, CIRCLE_SEGMENTS);
      group.add(shadow, mesh);
      return { mesh, shadow, home: { x: 0, y: 0 }, size: 1, rest, roundel: true };
    }
    const shape = roundedRect(1, T.tileAspect, T.corners[index % T.corners.length]!);
    const back = config.lineColors[index % config.lineColors.length]!;
    const paint: Paint = (n) => (n.z > 0.5 ? C.paper : n.z < -0.5 ? back : C.paperLo);
    const mesh = new Mesh(slab(shape, 1, T.tileAspect, T.depth, paint, id, atlas.rect(char)), materials.hud);
    const shadow = dropShadow(shape, C.shadow, materials.dropShadow);
    group.add(shadow, mesh);
    return { mesh, shadow, home: { x: 0, y: 0 }, size: 1, rest, roundel: false };
  });

  const buttonShape = roundedRect(B.aspect, 1, B.corners);
  const buttonPaint: Paint = (n) => (n.z > 0.5 ? C.yellow : C.yellowDk);
  const button: PieceView = {
    mesh: new Mesh(slab(buttonShape, B.aspect, 1, B.depth, buttonPaint, ids.next(), atlas.rect("label")), materials.hud),
    shadow: dropShadow(buttonShape, C.shadow, materials.dropShadow),
    home: { x: 0, y: 0 },
    size: 1,
  };
  group.add(button.shadow, button.mesh);

  /** World size of a tile's width: the drop shadow offset is measured in these for every piece. */
  let tileSize = 1;

  /**
   * Put a piece and its shadow where a pose says. The shadow sits behind and
   * down-right; it reaches further when the piece comes forward (dz > 0) and
   * pulls in when the piece is pressed back, like the app's buttons.
   */
  const apply = (
    view: PieceView,
    pose: TilePose,
    height: number,
    depth: number,
    rest: { pitch: number; yaw: number },
  ) => {
    const visible = pose.scale > 1e-4;
    view.mesh.visible = visible;
    view.shadow.visible = visible;
    const y = view.home.y + pose.dy * height;
    const reach = Math.max(0.2, 1 + pose.dz * 0.9) * tileSize;
    // Turn the piece to face the viewer first. Without this, perspective shows more
    // of the lower edge on pieces high on the screen and none on the button below.
    const facePitch = Math.atan2(y, config.hud.distance);
    const faceYaw = -Math.atan2(view.home.x, config.hud.distance);
    view.mesh.position.set(view.home.x, y, pose.dz * depth);
    view.mesh.rotation.set(pose.rotX + facePitch, pose.rotY + faceYaw, pose.rotZ);
    view.mesh.scale.setScalar(view.size * pose.scale);
    // The shadow sits behind the piece, where perspective would draw it smaller and
    // nearer the middle of the screen. Scale it and its position back up so that on
    // screen it is a plain offset copy, like a CSS box-shadow.
    const behind = depth * 0.7 - Math.min(0, pose.dz * depth);
    const undo = (config.hud.distance + behind) / config.hud.distance;
    view.shadow.position.set((view.home.x + D.x * reach) * undo, (y + D.y * reach) * undo, -behind);
    view.shadow.rotation.set(pose.rotX - rest.pitch + facePitch, pose.rotY - rest.yaw + faceYaw, pose.rotZ);
    view.shadow.scale.setScalar(view.size * pose.scale * undo);
  };

  return {
    group,
    tiles,
    button,
    setLayout(layout, unitsPerPx) {
      tileSize = layout.tileW * unitsPerPx;
      tiles.forEach((tile, i) => {
        const slot = layout.tiles[i];
        if (!slot) return;
        tile.home = { x: slot.cx * unitsPerPx, y: slot.cy * unitsPerPx };
        tile.size = tileSize;
      });
      button.home = { x: layout.button.cx * unitsPerPx, y: layout.button.cy * unitsPerPx };
      button.size = layout.button.h * unitsPerPx;
    },
    poseTile(index, pose) {
      const tile = tiles[index];
      if (tile) apply(tile, pose, tile.size * T.tileAspect, tile.size * T.depth, tile.rest);
    },
    poseButton(pose) {
      apply(button, { ...pose, rotY: 0 }, button.size, button.size * B.depth, { pitch: B.restPitchDeg * RAD, yaw: 0 });
    },
    dispose() {
      for (const view of [...tiles, button]) {
        view.mesh.geometry.dispose();
        view.shadow.geometry.dispose();
      }
    },
  };
}
