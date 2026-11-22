import test from "node:test";
import assert from "node:assert/strict";
import { samplePath, type Pt } from "../src/geometry";
import { LABEL_SIZE, SPOTS, TRACKS, type Label } from "../src/layout";
import { textWidth } from "../src/metrics";
import { T_STATIONS, T_ROUTES } from "../src/stations";
import { LINE_WIDTH } from "../src/style";

test("every station has a place on the diagram", () => {
  const missing = T_STATIONS.filter((s) => !SPOTS[s.id]).map((s) => s.id);
  assert.deepEqual(missing, []);
  const extra = Object.keys(SPOTS).filter((id) => !T_STATIONS.some((s) => s.id === id));
  assert.deepEqual(extra, []);
});

const trackPoints = TRACKS.map((t) => ({ line: t.line, pts: samplePath(t.pts, t.radius, 1) }));
const onTrack = (x: number, y: number, line: string) =>
  trackPoints.some((t) => t.line === line && t.pts.some(([px, py]) => Math.hypot(px - x, py - y) < 1.5));

test("every station sits on the line it belongs to", () => {
  for (const s of T_STATIONS) {
    const p = SPOTS[s.id]!;
    for (const line of s.lines) {
      // Ashmont is the Mattapan Line's end too; it is drawn on the Red Line.
      const drawn = line === "mattapan" && s.id === "ashmont" ? "red" : line;
      assert.ok(onTrack(p.x, p.y, drawn), `${s.id} is not on the ${line} line`);
    }
  }
});

test("stations follow each other along the line in travel order", () => {
  for (const r of T_ROUTES) {
    for (const pattern of r.patterns) {
      for (let i = 1; i < pattern.length; i++) {
        const a = SPOTS[pattern[i - 1]!]!, b = SPOTS[pattern[i]!]!;
        const gap = Math.hypot(a.x - b.x, a.y - b.y);
        assert.ok(gap >= 24, `${pattern[i - 1]} and ${pattern[i]} are only ${gap.toFixed(1)} apart`);
      }
    }
  }
});

/** A label's box: four corners, rotation applied. Glyphs reach 0.72 em up and 0.21 em down. */
function boxes(x: number, y: number, l: Label): Pt[][] {
  const size = l.size ?? LABEL_SIZE;
  const ax = x + l.dx, ay = y + l.dy;
  const rad = ((l.rotate ?? 0) * Math.PI) / 180;
  const rot = ([px, py]: Pt): Pt => {
    const dx = px - ax, dy = py - ay;
    return [ax + dx * Math.cos(rad) - dy * Math.sin(rad), ay + dx * Math.sin(rad) + dy * Math.cos(rad)];
  };
  return l.lines.map((text, i) => {
    const w = textWidth(text, size, l.bold);
    const bx = ax + i * (l.indent ?? 0), by = ay + i * (l.lineHeight ?? 22);
    const x0 = l.anchor === "end" ? bx - w : l.anchor === "middle" ? bx - w / 2 : bx;
    const top = by - size * 0.72, bottom = by + size * 0.21;
    return ([[x0, top], [x0 + w, top], [x0 + w, bottom], [x0, bottom]] as Pt[]).map(rot);
  });
}

function overlaps(a: Pt[], b: Pt[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < 4; i++) {
      const p = poly[i]!, q = poly[(i + 1) % 4]!;
      const nx = q[1] - p[1], ny = p[0] - q[0];
      const pa = a.map(([x, y]) => x * nx + y * ny), pb = b.map(([x, y]) => x * nx + y * ny);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  }
  return true;
}

/** True when the point is within `margin` of the box (or inside it). */
function inside(poly: Pt[], [x, y]: Pt, margin: number): boolean {
  let outside = false;
  let nearest = Infinity;
  for (let i = 0; i < 4; i++) {
    const p = poly[i]!, q = poly[(i + 1) % 4]!;
    const ex = q[0] - p[0], ey = q[1] - p[1];
    const len2 = ex * ex + ey * ey;
    // the box's corners run clockwise on screen, so a positive cross product is outside
    if ((x - p[0]) * ey - (y - p[1]) * ex > 0) outside = true;
    const t = Math.max(0, Math.min(1, ((x - p[0]) * ex + (y - p[1]) * ey) / len2));
    nearest = Math.min(nearest, Math.hypot(x - (p[0] + t * ex), y - (p[1] + t * ey)));
  }
  return !outside || nearest < margin;
}

test("no two station labels overlap", () => {
  const all = T_STATIONS.map((s) => ({ id: s.id, b: boxes(SPOTS[s.id]!.x, SPOTS[s.id]!.y, SPOTS[s.id]!.label) }));
  const clashes: string[] = [];
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++)
      for (const p of all[i]!.b) for (const q of all[j]!.b) if (overlaps(p, q)) clashes.push(`${all[i]!.id} / ${all[j]!.id}`);
  assert.deepEqual([...new Set(clashes)], []);
});

test("no station label sits on a subway line", () => {
  const clashes: string[] = [];
  for (const s of T_STATIONS) {
    const spot = SPOTS[s.id]!;
    for (const poly of boxes(spot.x, spot.y, spot.label)) {
      for (const t of TRACKS) {
        const half = LINE_WIDTH[t.line] / 2;
        if (samplePath(t.pts, t.radius, 2).some((p) => inside(poly, p, half - 1))) clashes.push(`${s.id} on ${t.id}`);
      }
    }
  }
  assert.deepEqual([...new Set(clashes)], []);
});

import { FERRY_NAMES, FERRY_NOTES, RAIL, RAIL_NOTES, SILVER, SILVER_NOTES, type Note } from "../src/extras";
import { MINOR_SIZE } from "../src/style";

const noteLabel = (n: Note): Label => ({
  lines: n.lines,
  dx: 0,
  dy: 0,
  anchor: n.anchor,
  ...(n.bold ? { bold: true } : {}),
  ...(n.rotate ? { rotate: n.rotate } : {}),
  size: n.size ?? MINOR_SIZE,
  lineHeight: (n.size ?? MINOR_SIZE) * 1.06,
});
const notes = [...RAIL_NOTES, ...SILVER_NOTES, ...FERRY_NOTES, ...FERRY_NAMES].map((n) => ({
  name: n.lines.join(" "),
  b: boxes(n.x, n.y, noteLabel(n)),
}));

test("station labels and the other names on the map do not overlap", () => {
  const clashes: string[] = [];
  for (const s of T_STATIONS) {
    const spot = SPOTS[s.id]!;
    for (const p of boxes(spot.x, spot.y, spot.label))
      for (const n of notes) for (const q of n.b) if (overlaps(p, q)) clashes.push(`${s.id} / ${n.name}`);
  }
  for (let i = 0; i < notes.length; i++)
    for (let j = i + 1; j < notes.length; j++)
      for (const p of notes[i]!.b) for (const q of notes[j]!.b) if (overlaps(p, q)) clashes.push(`${notes[i]!.name} / ${notes[j]!.name}`);
  assert.deepEqual([...new Set(clashes)], []);
});

test("no name sits on the commuter rail or the Silver Line, unless it has a halo", () => {
  const clashes: string[] = [];
  const named = [
    ...T_STATIONS.filter((s) => !SPOTS[s.id]!.label.halo).map((s) => ({ name: s.id, b: boxes(SPOTS[s.id]!.x, SPOTS[s.id]!.y, SPOTS[s.id]!.label) })),
    ...notes,
  ];
  const lines = [...RAIL.map((r) => ({ r, half: 4.5, kind: "rail" })), ...SILVER.map((r) => ({ r, half: 7, kind: "silver" }))];
  for (const { name, b } of named)
    for (const poly of b)
      for (const { r, half, kind } of lines)
        if (samplePath(r.pts, r.radius, 2).some((p) => inside(poly, p, half - 1))) clashes.push(`${name} on ${kind}`);
  assert.deepEqual([...new Set(clashes)], []);
});

test("no rail, Silver Line or ferry name sits on a subway line", () => {
  const clashes: string[] = [];
  for (const { name, b } of notes)
    for (const poly of b)
      for (const t of TRACKS)
        if (samplePath(t.pts, t.radius, 2).some((p) => inside(poly, p, LINE_WIDTH[t.line] / 2 - 1))) clashes.push(`${name} on ${t.id}`);
  assert.deepEqual([...new Set(clashes)], []);
});
