// Draws the diagram as one SVG string. The app and the checking tools all use this, so
// what is compared against the reference is exactly what ships.
import { roundedPath, type Pt } from "./geometry";
import { LABEL_SIZE, MAP_SIZE, SPOTS, TRACKS, type Label } from "./layout";
import {
  BADGES, CAPTIONS, CONCOURSE, FERRY, FERRY_ARROWS, FERRY_NAMES, FERRY_NOTES, FERRY_STOPS, RAIL, RAIL_ARROWS, RAIL_NOTES, RAIL_STOPS, SILVER, SILVER_NOTES, SILVER_PILLS,
  SILVER_STOPS, TERMINALS, type Note,
} from "./extras";
import { textWidth } from "./metrics";
import { T_STATIONS } from "./stations";
import { COLORS, DOT_R, FONT, HUB_R, HUB_STROKE, LINE_COLOR, LINE_WIDTH, MINOR_SIZE, RAIL_WIDTH, SILVER_WIDTH } from "./style";
import { WATER_PATH } from "./water";

export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** The diagram without the reference's title and legend. */
export const FULL_VIEW: View = { x: 36, y: 36, w: 1872, h: 1672 };

export interface RenderOptions {
  view?: View;
  /** Station names, line captions and the smaller notes. Off for a small overview. */
  labels?: boolean;
  /** Paint the paper background. */
  background?: boolean;
  /** Station ids to mark as stamped: a yellow disc with an ink ring. */
  stamped?: readonly string[];
  /** The key in the empty top-left corner, and the credit line. On with labels. */
  legend?: boolean;
}

/** Credit the CC BY 2.0 licence asks for, and where the network comes from. */
export const CREDIT = "Diagram after Michael Kvrivishvili's 2013 MBTA map (CC BY 2.0). Stations, lines and accessibility: MBTA V3 API, November 2026. Not to scale.";

const n = (v: number): string => String(Math.round(v * 100) / 100);
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

function labelSvg(x: number, y: number, l: Label): string {
  const ax = x + l.dx, ay = y + l.dy;
  const lh = l.lineHeight ?? 22;
  const size = l.size ?? LABEL_SIZE;
  const attrs = [
    `text-anchor="${l.anchor}"`,
    size === LABEL_SIZE ? "" : `font-size="${n(size)}"`,
    l.bold ? `font-weight="700"` : "",
    l.rotate ? `transform="rotate(${n(l.rotate)} ${n(ax)} ${n(ay)})"` : "",
    l.halo ? `stroke="${COLORS.paper}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"` : "",
  ].filter(Boolean).join(" ");
  const spans = l.lines
    .map((t, i) => `<tspan x="${n(ax + i * (l.indent ?? 0))}" y="${n(ay + i * lh)}">${esc(t)}</tspan>`)
    .join("");
  return `<text ${attrs}>${spans}</text>`;
}

function noteSvg(t: Note): string {
  const lineHeight = (t.size ?? MINOR_SIZE) * 1.06;
  const attrs = [
    `text-anchor="${t.anchor}"`,
    t.size ? `font-size="${n(t.size)}"` : "",
    t.bold ? `font-weight="700"` : "",
    t.rotate ? `transform="rotate(${n(t.rotate)} ${n(t.x)} ${n(t.y)})"` : "",
  ].filter(Boolean).join(" ");
  const spans = t.lines.map((s, i) => `<tspan x="${n(t.x)}" y="${n(t.y + i * lineHeight)}">${esc(s)}</tspan>`).join("");
  return `<text ${attrs}>${spans}</text>`;
}

/** The far end of a label's first line, where the not-accessible mark goes: [x, y, rotation, anchor point]. */
function labelEnd(x: number, y: number, l: Label): { x: number; y: number; rotate?: string } {
  const ax = x + l.dx, ay = y + l.dy;
  const size = l.size ?? LABEL_SIZE;
  const w = textWidth(l.lines[0] ?? "", size, l.bold);
  const gap = size * 0.52;
  const ex = l.anchor === "end" ? ax - w - gap : l.anchor === "middle" ? ax + w / 2 + gap : ax + w + gap;
  return { x: ex, y: ay - size * 0.33, ...(l.rotate ? { rotate: `rotate(${n(l.rotate)} ${n(ax)} ${n(ay)})` } : {}) };
}

/** A wheelchair struck through, drawn around (0, 0), about 16 units across. */
const NO_ACCESS =
  `<g fill="none" stroke="${COLORS.mark}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
  `<circle cx="-0.6" cy="-6" r="1.5" fill="${COLORS.mark}" stroke="none"/>` +
  `<path d="M-0.6 -3.6V1.2H3.6L5.6 5.6"/><path d="M-0.6 -1.4H3"/><path d="M-2.4 -0.6A4.4 4.4 0 1 0 3.4 4.6"/>` +
  `<path d="M-7.5 7.5L7.5 -7.5"/></g>`;

function arrow(tip: Pt, dir: Pt): string {
  const len = Math.hypot(dir[0], dir[1]);
  const ux = dir[0] / len, uy = dir[1] / len;
  const bx = tip[0] - ux * 19, by = tip[1] - uy * 19;
  return `<path d="M${n(tip[0])} ${n(tip[1])}L${n(bx - uy * 8.5)} ${n(by + ux * 8.5)}L${n(bx + uy * 8.5)} ${n(by - ux * 8.5)}Z"/>`;
}

function railLayer(labels: boolean): string {
  const out: string[] = [];
  out.push(`<g fill="none" stroke="${COLORS.rail}" stroke-width="${RAIL_WIDTH}" stroke-linejoin="round">`);
  for (const r of RAIL) out.push(`<path d="${roundedPath(r.pts, r.radius)}"/>`);
  out.push(`</g>`);
  out.push(`<g stroke="${COLORS.rail}" stroke-width="15">`);
  for (const [x, y, d] of RAIL_STOPS) {
    const len = Math.hypot(d[0], d[1]);
    out.push(`<path d="M${n(x)} ${n(y)}l${n((d[0] / len) * 14)} ${n((d[1] / len) * 14)}"/>`);
  }
  out.push(`</g>`);
  out.push(`<g fill="${COLORS.rail}">${RAIL_ARROWS.map(([tip, dir]) => arrow(tip, dir)).join("")}</g>`);
  if (labels) out.push(`<g fill="${COLORS.rail}" font-size="${MINOR_SIZE}">${RAIL_NOTES.map((t) => noteSvg(t)).join("")}</g>`);
  return out.join("");
}

function ferryLayer(labels: boolean): string {
  const out: string[] = [];
  out.push(`<g fill="none" stroke="${COLORS.ferry}" stroke-width="3" stroke-linecap="round" stroke-dasharray="0.1 6.4">`);
  for (const r of FERRY) out.push(`<path d="${roundedPath(r.pts, r.radius)}"/>`);
  out.push(`</g>`);
  out.push(`<g fill="${COLORS.ferry}">`);
  for (const [x, y] of FERRY_STOPS) out.push(`<circle cx="${n(x)}" cy="${n(y)}" r="4.6"/>`);
  for (const [tip, dir] of FERRY_ARROWS) {
    const len = Math.hypot(dir[0], dir[1]);
    const ux = dir[0] / len, uy = dir[1] / len;
    const bx = tip[0] - ux * 10, by = tip[1] - uy * 10;
    out.push(`<path d="M${n(tip[0])} ${n(tip[1])}L${n(bx - uy * 5)} ${n(by + ux * 5)}L${n(bx + uy * 5)} ${n(by - ux * 5)}Z"/>`);
  }
  out.push(`</g>`);
  if (labels) {
    out.push(`<g>${FERRY_NOTES.map((t) => noteSvg(t)).join("")}</g>`);
    out.push(`<g fill="${COLORS.ferry}" font-size="${MINOR_SIZE}">${FERRY_NAMES.map((t) => noteSvg(t)).join("")}</g>`);
  }
  return out.join("");
}

function silverLayer(): string {
  const out: string[] = [];
  out.push(`<g fill="none" stroke="${COLORS.silver}" stroke-width="${SILVER_WIDTH}" stroke-linecap="round" stroke-linejoin="round">`);
  for (const r of SILVER) out.push(`<path d="${roundedPath(r.pts, r.radius)}"/>`);
  out.push(`</g>`);
  return out.join("");
}

function silverMarks(labels: boolean): string {
  const out: string[] = [];
  out.push(`<g fill="#fff">${SILVER_STOPS.map(([x, y]) => `<circle cx="${n(x)}" cy="${n(y)}" r="3.9"/>`).join("")}</g>`);
  if (!labels) return out.join("");
  out.push(`<g font-size="${MINOR_SIZE}">${SILVER_NOTES.map((t) => noteSvg(t)).join("")}</g>`);
  out.push(`<g font-size="15" font-weight="700" text-anchor="middle">`);
  for (const [x, y, text] of SILVER_PILLS) {
    out.push(`<rect x="${n(x - 21)}" y="${n(y - 12)}" width="42" height="24" rx="12" fill="${COLORS.silver}"/>`);
    out.push(`<text x="${n(x)}" y="${n(y + 5.4)}" fill="#fff">${text}</text>`);
  }
  for (const [letter, y] of TERMINALS) {
    out.push(`<rect x="1674.5" y="${n(y - 10)}" width="20" height="20" rx="3.5" fill="${COLORS.ink}"/>`);
    out.push(`<text x="1684.5" y="${n(y + 5.5)}" fill="#fff">${letter}</text>`);
  }
  out.push(`</g>`);
  // the routes named inside their own bands downtown
  out.push(`<g fill="#fff" font-size="9.5"><text x="1056" y="832.8"><tspan font-weight="700">SL5</tspan> to Nubian</text>`);
  out.push(`<text x="1056" y="1025.2"><tspan font-weight="700">SL4</tspan> to Nubian</text></g>`);
  return out.join("");
}

function badgeLayer(): string {
  const out: string[] = [`<g font-weight="700" text-anchor="middle" fill="#fff">`];
  for (const b of BADGES) {
    const c = COLORS[b.line];
    out.push(`<circle cx="${n(b.x)}" cy="${n(b.y)}" r="16" fill="${c}"/>`);
    out.push(`<text x="${n(b.x)}" y="${n(b.y + 5.6)}" font-size="16">${b.text}</text>`);
    if (b.branch) {
      out.push(`<circle cx="${n(b.x + 27)}" cy="${n(b.y)}" r="13.2" fill="${c}" stroke="${COLORS.paper}" stroke-width="1.6"/>`);
      out.push(`<text x="${n(b.x + 27)}" y="${n(b.y + 5.6)}" font-size="16">${b.branch}</text>`);
    }
  }
  out.push(`</g>`);
  return out.join("");
}

function legendLayer(): string {
  const x = 60, row = 34;
  let y = 84;
  const out: string[] = [`<g font-size="16">`];
  const item = (symbol: string, text: string) => {
    out.push(`<g transform="translate(${x} ${y})">${symbol}</g><text x="${x + 52}" y="${y + 5.5}">${esc(text)}</text>`);
    y += row;
  };
  item(`<path d="M0 0H36" stroke="${COLORS.green}" stroke-width="17" stroke-linecap="round"/><circle cx="18" r="${DOT_R}" fill="#fff"/>`, "Subway and light rail stop");
  item(`<path d="M0 0H36" stroke="${COLORS.red}" stroke-width="18" stroke-linecap="round"/><circle cx="18" r="${HUB_R}" fill="#fff" stroke="${COLORS.ink}" stroke-width="${HUB_STROKE}"/>`, "Transfer station");
  item(`<path d="M0 0H36" stroke="${COLORS.silver}" stroke-width="${SILVER_WIDTH}" stroke-linecap="round"/><circle cx="18" r="3.9" fill="#fff"/>`, "Silver Line (bus rapid transit)");
  item(`<path d="M0 0H36" stroke="${COLORS.rail}" stroke-width="${RAIL_WIDTH}"/><path d="M18 0v14" stroke="${COLORS.rail}" stroke-width="15"/>`, "Commuter Rail");
  item(`<path d="M0 0H36" stroke="${COLORS.ferry}" stroke-width="3" stroke-linecap="round" stroke-dasharray="0.1 6.4" fill="none"/><circle cx="18" r="4.6" fill="${COLORS.ferry}"/>`, "Ferry");
  item(`<g transform="translate(18 0)">${NO_ACCESS}</g>`, "Not accessible");
  item(`<circle cx="18" r="7.6" fill="${COLORS.closed}"/><path d="M14.8 -3.2l6.4 6.4m0 -6.4l-6.4 6.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`, "Closed for construction");
  out.push(`</g>`);
  return out.join("");
}

function creditLayer(view: View): string {
  return `<text x="${n(view.x + 22)}" y="${n(view.y + view.h - 16)}" font-size="11" fill="${COLORS.ink}" fill-opacity="0.7">${esc(CREDIT)}</text>`;
}

/** The whole map as an SVG document. */
export function renderMap(opts: RenderOptions = {}): string {
  const view = opts.view ?? FULL_VIEW;
  const labels = opts.labels ?? true;
  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(view.x)} ${n(view.y)} ${n(view.w)} ${n(view.h)}" font-family="${FONT}" font-size="${LABEL_SIZE}" fill="${COLORS.ink}">`,
  );
  if (opts.background ?? true) out.push(`<rect x="0" y="0" width="${MAP_SIZE}" height="${MAP_SIZE}" fill="${COLORS.paper}"/>`);
  out.push(`<path d="${WATER_PATH}" fill="${COLORS.water}"/>`);
  out.push(ferryLayer(labels));
  out.push(railLayer(labels));
  out.push(silverLayer());

  out.push(`<g fill="none" stroke-linecap="round" stroke-linejoin="round">`);
  for (const t of TRACKS) {
    out.push(`<path d="${roundedPath(t.pts, t.radius)}" stroke="${LINE_COLOR[t.line]}" stroke-width="${LINE_WIDTH[t.line]}"/>`);
  }
  out.push(`</g>`);
  if (labels) {
    out.push(`<g fill="#fff" fill-opacity="0.6" font-size="9.5" letter-spacing="1.6" text-anchor="middle">`);
    for (const [text, x, y, rot] of CAPTIONS) out.push(`<text x="${n(x)}" y="${n(y + 3.3)}" transform="rotate(${rot} ${n(x)} ${n(y)})">${text}</text>`);
    out.push(`</g>`);
  }
  out.push(`<path d="${CONCOURSE}" fill="none" stroke="${COLORS.ink}" stroke-width="9"/><path d="${CONCOURSE}" fill="none" stroke="#fff" stroke-width="4.6"/>`);
  out.push(silverMarks(labels));
  out.push(badgeLayer());

  const stations = T_STATIONS.filter((s) => SPOTS[s.id]);
  out.push(`<g fill="#fff">`);
  for (const s of stations) {
    const p = SPOTS[s.id]!;
    if (!p.hub) out.push(`<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${DOT_R}"/>`);
  }
  out.push(`</g>`);
  out.push(`<g fill="#fff" stroke="${COLORS.ink}" stroke-width="${HUB_STROKE}">`);
  for (const s of stations) {
    const p = SPOTS[s.id]!;
    if (p.hub) out.push(`<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${HUB_R}"/>`);
  }
  out.push(`</g>`);
  // a station shut for a long project: struck out in red, as the MBTA's own map does
  for (const s of stations) {
    if (!s.suspended) continue;
    const p = SPOTS[s.id]!;
    out.push(`<circle cx="${n(p.x)}" cy="${n(p.y)}" r="7.6" fill="${COLORS.closed}" stroke="#fff" stroke-width="1.4"/>`);
    out.push(`<path d="M${n(p.x - 3.2)} ${n(p.y - 3.2)}l6.4 6.4m0 -6.4l-6.4 6.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`);
  }

  const stamped = new Set(opts.stamped ?? []);
  if (stamped.size) {
    // bigger on an overview without names, so a stamp still shows at phone width
    const r = labels ? 9.5 : 28;
    out.push(`<g fill="${COLORS.stamp}" stroke="${COLORS.ink}" stroke-width="${labels ? 3.4 : 8}">`);
    for (const s of stations) {
      if (!stamped.has(s.id)) continue;
      const p = SPOTS[s.id]!;
      out.push(`<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${p.hub ? Math.max(r, HUB_R + 1) : r}"/>`);
    }
    out.push(`</g>`);
  }

  if (labels && (opts.legend ?? true)) out.push(legendLayer(), creditLayer(view));
  if (labels) {
    out.push(`<g>`);
    for (const s of stations) {
      const p = SPOTS[s.id]!;
      out.push(labelSvg(p.x, p.y, p.label));
      if (!s.accessible && !s.suspended) {
        const e = labelEnd(p.x, p.y, p.label);
        out.push(`<g transform="${e.rotate ? `${e.rotate} ` : ""}translate(${n(e.x)} ${n(e.y)})">${NO_ACCESS}</g>`);
      }
      if (s.suspended) {
        const l = p.label;
        const ax = p.x + l.dx, ay = p.y + l.dy + 11.5;
        out.push(`<text x="${n(ax)}" y="${n(ay)}" text-anchor="${l.anchor}" font-size="9.5" font-weight="700" fill="${COLORS.closed}">${esc(s.suspended)}</text>`);
      }
    }
    out.push(`</g>`);
  }
  out.push(`</svg>`);
  return out.join("");
}
