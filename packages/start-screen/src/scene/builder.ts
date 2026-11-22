/**
 * Builds the flat-coloured geometry the scene is drawn from.
 *
 * Every triangle carries four things the shaders need:
 * - position
 * - normal: one flat normal per triangle, so faces are evenly coloured
 * - color:  the fill, chosen per face (top / side / front ...)
 * - oid:    "object id". The ink pass draws a line wherever two different ids
 *           meet, so pieces that should be outlined get their own id, and painted
 *           details (windows, stripes) share the id of what they are painted on.
 * - uv:     where to read the letter texture, or (-1, -1) for plain faces.
 */
import { BufferGeometry, Euler, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from "three";

export type Rgb = readonly [number, number, number];
interface XYZ {
  x: number;
  y: number;
  z: number;
}
/** A hex colour, or a function that picks one from the way a face points and where it is. */
export type Paint = string | ((normal: XYZ, center: XYZ) => string);
export type UvFn = (normal: XYZ, point: XYZ) => readonly [number, number] | null;

const rgbCache = new Map<string, Rgb>();

/** "#rrggbb" to 0..1 numbers. Colours are used exactly as written: no lighting, no colour-space maths. */
export function hexToRgb(hex: string): Rgb {
  let rgb = rgbCache.get(hex);
  if (!rgb) {
    const n = Number.parseInt(hex.replace("#", ""), 16);
    rgb = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    rgbCache.set(hex, rgb);
  }
  return rgb;
}

/** Hands out object ids. 0 is never given out: it means "background, nothing to ink". */
export class IdAllocator {
  private last = 0;
  next(): number {
    return ++this.last;
  }
}

const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _e = new Euler();

/** A matrix that moves to (x, y, z), turns `yaw` radians about the vertical, and scales. */
export function place(x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx): Matrix4 {
  return new Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, yaw, 0)), _s.set(sx, sy, sz));
}

/** Like `place`, with a full rotation (radians, applied X then Y then Z). */
export function placeTurned(x: number, y: number, z: number, rx: number, ry: number, rz: number, scale = 1): Matrix4 {
  return new Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(scale, scale, scale));
}

const NO_UV = [-1, -1] as const;

export class GeoBuilder {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly ids: number[] = [];
  private readonly uvs: number[] = [];

  /** Add a shape, moved by `matrix`, painted, as (part of) the inked piece `id`. */
  add(geometry: BufferGeometry, matrix: Matrix4, paint: Paint, id: number, uv?: UvFn): this {
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    const position = source.getAttribute("position");
    const mirrored = matrix.determinant() < 0;
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    const ab = new Vector3();
    const ac = new Vector3();
    const normal = new Vector3();
    const center = new Vector3();

    for (let i = 0; i + 2 < position.count; i += 3) {
      a.fromBufferAttribute(position, i).applyMatrix4(matrix);
      b.fromBufferAttribute(position, mirrored ? i + 2 : i + 1).applyMatrix4(matrix);
      c.fromBufferAttribute(position, mirrored ? i + 1 : i + 2).applyMatrix4(matrix);
      normal.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
      // Sphere poles and the like produce zero-area slivers; drop them.
      if (normal.lengthSq() < 1e-14) continue;
      normal.normalize();
      center.copy(a).add(b).add(c).divideScalar(3);
      const [r, g, bl] = hexToRgb(typeof paint === "string" ? paint : paint(normal, center));
      for (const v of [a, b, c]) {
        this.positions.push(v.x, v.y, v.z);
        this.normals.push(normal.x, normal.y, normal.z);
        this.colors.push(r, g, bl);
        this.ids.push(id);
        const st = uv?.(normal, v) ?? NO_UV;
        this.uvs.push(st[0], st[1]);
      }
    }
    if (source !== geometry) source.dispose();
    return this;
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("normal", new Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute("oid", new Float32BufferAttribute(this.ids, 1));
    geometry.setAttribute("uv", new Float32BufferAttribute(this.uvs, 2));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
}
