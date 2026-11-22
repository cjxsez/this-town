// Path maths for the diagram: polylines whose corners are rounded with circular arcs.
export type Pt = readonly [number, number];

const num = (n: number): string => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
};

interface Corner {
  /** Where the arc starts and ends. */
  s: Pt;
  e: Pt;
  r: number;
  /** 1 turns clockwise on screen (y down), 0 the other way. */
  sweep: 0 | 1;
  centre: Pt;
  turn: number;
}

function corner(p0: Pt, v: Pt, p1: Pt, radius: number): Corner | null {
  const ax = v[0] - p0[0], ay = v[1] - p0[1];
  const bx = p1[0] - v[0], by = p1[1] - v[1];
  const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
  if (radius <= 0 || la === 0 || lb === 0) return null;
  const ux = ax / la, uy = ay / la, wx = bx / lb, wy = by / lb;
  const turn = Math.acos(Math.max(-1, Math.min(1, ux * wx + uy * wy)));
  if (turn < 1e-9) return null;
  const half = Math.tan(turn / 2);
  const t = Math.min(radius * half, la, lb);
  const r = t / half;
  const cross = ux * wy - uy * wx;
  const side = cross > 0 ? 1 : -1;
  const s: Pt = [v[0] - ux * t, v[1] - uy * t];
  const e: Pt = [v[0] + wx * t, v[1] + wy * t];
  return { s, e, r, sweep: cross > 0 ? 1 : 0, centre: [s[0] - uy * r * side, s[1] + ux * r * side], turn };
}

const radiusAt = (radius: number | readonly number[], i: number): number =>
  typeof radius === "number" ? radius : (radius[i] ?? 0);

/** SVG path data for a polyline, each interior corner rounded by its radius (shrunk when a segment is too short). */
export function roundedPath(pts: readonly Pt[], radius: number | readonly number[]): string {
  const first = pts[0];
  if (!first) return "";
  let d = `M${num(first[0])} ${num(first[1])}`;
  let at: Pt = first;
  const line = (p: Pt) => {
    if (Math.hypot(p[0] - at[0], p[1] - at[1]) > 1e-9) d += `L${num(p[0])} ${num(p[1])}`;
    at = p;
  };
  for (let i = 1; i < pts.length - 1; i++) {
    const v = pts[i]!;
    const c = corner(pts[i - 1]!, v, pts[i + 1]!, radiusAt(radius, i - 1));
    if (!c) {
      line(v);
      continue;
    }
    line(c.s);
    d += `A${num(c.r)} ${num(c.r)} 0 0 ${c.sweep} ${num(c.e[0])} ${num(c.e[1])}`;
    at = c.e;
  }
  if (pts.length > 1) line(pts[pts.length - 1]!);
  return d;
}

/** The same rounded polyline as points about `step` apart, for measuring and tests. */
export function samplePath(pts: readonly Pt[], radius: number | readonly number[], step = 1): Pt[] {
  const out: Pt[] = [];
  const first = pts[0];
  if (!first) return out;
  out.push(first);
  let at: Pt = first;
  const line = (p: Pt) => {
    const len = Math.hypot(p[0] - at[0], p[1] - at[1]);
    const n = Math.max(1, Math.round(len / step));
    for (let k = 1; k <= n; k++) out.push([at[0] + ((p[0] - at[0]) * k) / n, at[1] + ((p[1] - at[1]) * k) / n]);
    at = p;
  };
  for (let i = 1; i < pts.length - 1; i++) {
    const v = pts[i]!;
    const c = corner(pts[i - 1]!, v, pts[i + 1]!, radiusAt(radius, i - 1));
    if (!c) {
      if (Math.hypot(v[0] - at[0], v[1] - at[1]) > 1e-9) line(v);
      continue;
    }
    if (Math.hypot(c.s[0] - at[0], c.s[1] - at[1]) > 1e-9) line(c.s);
    const a0 = Math.atan2(c.s[1] - c.centre[1], c.s[0] - c.centre[0]);
    const dir = c.sweep === 1 ? 1 : -1;
    const n = Math.max(2, Math.round((c.r * c.turn) / step));
    for (let k = 1; k <= n; k++) {
      const a = a0 + (dir * c.turn * k) / n;
      out.push(k === n ? c.e : [c.centre[0] + c.r * Math.cos(a), c.centre[1] + c.r * Math.sin(a)]);
    }
    at = c.e;
  }
  const last = pts[pts.length - 1]!;
  if (pts.length > 1 && Math.hypot(last[0] - at[0], last[1] - at[1]) > 1e-9) line(last);
  return out;
}

/** n points evenly spaced strictly between a and b. */
export function between(a: Pt, b: Pt, n: number): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / (n + 1);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as Pt;
  });
}

/** The point `dist` along a polyline (clamped to its end). */
export function along(pts: readonly Pt[], dist: number): Pt {
  let left = dist;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= len && len > 0) return [a[0] + ((b[0] - a[0]) * left) / len, a[1] + ((b[1] - a[1]) * left) / len];
    left -= len;
  }
  return pts[pts.length - 1] ?? [0, 0];
}
