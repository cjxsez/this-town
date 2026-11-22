// Hand-drawn architecture diagrams for the README: pencil strokes (two slightly different
// wobbly passes, overshooting corners) and the Gaegu handwriting the app uses.
//
//   pnpm diagrams        writes docs/diagrams/<name>.svg and renders <name>.png with Chrome
//
// The SVGs embed the font, so they look the same anywhere; the PNGs (2x) are what the
// README shows, because GitHub renders them everywhere. The randomness is seeded, so the
// same input draws the same lines. Needs Google Chrome (set CHROME_PATH if it is elsewhere).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs/diagrams");
const fontDir = join(root, "apps/phone-web/node_modules/@fontsource/gaegu/files");
const chrome = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const font = (w) => readFileSync(join(fontDir, `gaegu-latin-${w}-normal.woff2`)).toString("base64");
const FONT_CSS = `@font-face{font-family:Gaegu;font-weight:400;src:url(data:font/woff2;base64,${font(400)}) format("woff2")}
@font-face{font-family:Gaegu;font-weight:700;src:url(data:font/woff2;base64,${font(700)}) format("woff2")}
text{font-family:Gaegu,"Comic Sans MS",cursive;fill:#262626}`;

const INK = "#262626";
const PAPER = "#fffdf7";

// ---------------------------------------------------------------- pencil strokes
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const j = (a) => (rnd() * 2 - 1) * a;
const f = (v) => v.toFixed(1);

/** One pencil stroke: a slight bow, ends jittered and overshooting a little. */
function wob(x1, y1, x2, y2, a = 1.2) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const o = Math.min(3, L * 0.03), b = j(Math.min(a * 1.4, 0.6 + L * 0.012));
  const P = (t, k) => [x1 + dx * t + nx * b * k + j(a * 0.35), y1 + dy * t + ny * b * k + j(a * 0.35)];
  const s = [x1 - ux * o * rnd() + j(a * 0.5), y1 - uy * o * rnd() + j(a * 0.5)];
  const e = [x2 + ux * o * rnd() + j(a * 0.5), y2 + uy * o * rnd() + j(a * 0.5)];
  const c1 = P(0.33, 1), c2 = P(0.66, 0.8);
  return `M${f(s[0])} ${f(s[1])}C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(e[0])} ${f(e[1])}`;
}
/** A line with no overshoot (connectors, so arrowheads land on target). */
function tight(x1, y1, x2, y2, a = 1) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, b = j(Math.min(a * 1.6, 0.5 + L * 0.01));
  return `M${f(x1)} ${f(y1)}C${f(x1 + dx * 0.33 + nx * b)} ${f(y1 + dy * 0.33 + ny * b)} ${f(x1 + dx * 0.66 + nx * b * 0.7)} ${f(y1 + dy * 0.66 + ny * b * 0.7)} ${f(x2)} ${f(y2)}`;
}
function rrect(x, y, w, h, r, a = 1.2) {
  r = Math.min(r, w / 2, h / 2);
  let d = "";
  const passes = Math.max(w, h) < 40 ? 1 : 2;
  for (let p = 0; p < passes; p++) {
    const A = a * (p ? 1.7 : 1);
    d += wob(x + r, y, x + w - r, y, A) + wob(x + w, y + r, x + w, y + h - r, A) + wob(x + w - r, y + h, x + r, y + h, A) + wob(x, y + h - r, x, y + r, A);
    if (r > 2) for (const [ax, ay, cx, cy, bx, by] of [[x + w - r, y, x + w, y, x + w, y + r], [x + w, y + h - r, x + w, y + h, x + w - r, y + h], [x + r, y + h, x, y + h, x, y + h - r], [x, y + r, x, y, x + r, y]])
      d += `M${f(ax + j(A * 0.5))} ${f(ay + j(A * 0.5))}Q${f(cx + j(A * 0.6))} ${f(cy + j(A * 0.6))} ${f(bx + j(A * 0.5))} ${f(by + j(A * 0.5))}`;
  }
  return d;
}
function oval(cx, cy, rx, ry, a = 1.2) {
  let d = "";
  const passes = Math.max(rx, ry) < 14 ? 1 : 2;
  for (let p = 0; p < passes; p++) {
    const a0 = rnd() * 6.28, N = 28, pts = [];
    for (let i = 0; i <= N + 2; i++) { const t = a0 + (i / N) * 6.55; pts.push([cx + Math.cos(t) * (rx + j(a)), cy + Math.sin(t) * (ry + j(a))]); }
    d += `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${f((pts[i][0] + pts[i + 1][0]) / 2)} ${f((pts[i][1] + pts[i + 1][1]) / 2)}`;
  }
  return d;
}

// ---------------------------------------------------------------- a drawing
function canvas(name, w, h, title, subtitle) {
  seed = [...name].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 2147483647, 7) || 7;
  const parts = [];
  let clipN = 0;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const stroke = (d, sw = 2, extra = "") =>
    parts.push(`<path d="${d}" fill="none" stroke="${INK}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${extra.includes("stroke-opacity") ? "" : ' stroke-opacity="0.9"'}${extra}/>`);
  const c = {
    w, h, parts,
    text(x, y, s, { size = 18, bold = false, anchor = "start", opacity = 1, italic = false } = {}) {
      parts.push(`<text x="${f(x)}" y="${f(y)}" font-size="${size}" font-weight="${bold ? 700 : 400}" text-anchor="${anchor}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ""}${italic ? ' font-style="italic"' : ""}>${esc(s)}</text>`);
    },
    lines(x, y, list, { size = 17, gap = 1.22, bold = false, anchor = "start" } = {}) {
      list.forEach((s, i) => c.text(x, y + i * size * gap, s, { size, bold: bold || s.startsWith("**"), anchor }));
    },
    hatch(x, y, w2, h2, r = 12, spacing = 9) {
      const id = `clip${name}${clipN++}`;
      parts.push(`<clipPath id="${id}"><rect x="${f(x)}" y="${f(y)}" width="${f(w2)}" height="${f(h2)}" rx="${r}"/></clipPath>`);
      let d = "";
      for (let k = -h2; k < w2; k += spacing) d += wob(x + k, y + h2 + 2, x + k + h2, y - 2, 0.8);
      parts.push(`<g clip-path="url(#${id})">`); stroke(d, 1, ' stroke-opacity="0.16"'); parts.push("</g>");
    },
    /** A box with a bold title and body lines. Returns its anchor points. */
    box(x, y, w2, h2, { title, body = [], r = 14, sw = 2.2, size = 17, titleSize = 23, hatch = false, dash = null, center = false, pad = 16 } = {}) {
      if (hatch) c.hatch(x, y, w2, h2, r);
      parts.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(w2)}" height="${f(h2)}" rx="${r}" fill="${PAPER}" fill-opacity="${hatch ? 0 : 0.85}"/>`);
      stroke(rrect(x, y, w2, h2, r), sw, dash ? ` stroke-dasharray="${dash}"` : "");
      const tx = center ? x + w2 / 2 : x + pad, anchor = center ? "middle" : "start";
      if (title) {
        const ty = y + pad + titleSize * 0.85;
        c.text(tx, ty, title, { size: titleSize, bold: true, anchor });
        if (body.length) c.lines(tx, ty + titleSize * 0.5 + 6 + size * 0.6, body, { size, anchor });
      } else if (body.length) c.lines(tx, y + pad + size * 0.9, body, { size, anchor });
      return box(x, y, w2, h2);
    },
    /** A database cylinder. */
    cyl(x, y, w2, h2, { title, body = [], size = 16 } = {}) {
      const ry = 14;
      parts.push(`<rect x="${x}" y="${y + ry}" width="${w2}" height="${h2 - ry * 2}" fill="${PAPER}"/>`);
      stroke(oval(x + w2 / 2, y + ry, w2 / 2, ry) + wob(x, y + ry, x, y + h2 - ry) + wob(x + w2, y + ry, x + w2, y + h2 - ry), 2.2);
      const bottom = `M${x} ${y + h2 - ry} A ${w2 / 2} ${ry} 0 0 0 ${x + w2} ${y + h2 - ry}`;
      stroke(bottom, 2.2); stroke(`M${x + 1} ${y + h2 - ry + 1} A ${w2 / 2 - 1} ${ry - 1} 0 0 0 ${x + w2 - 1} ${y + h2 - ry + 1.5}`, 1.2);
      c.text(x + w2 / 2, y + ry * 2 + 22, title, { size: 22, bold: true, anchor: "middle" });
      c.lines(x + w2 / 2, y + ry * 2 + 50, body, { size, anchor: "middle" });
      return box(x, y, w2, h2);
    },
    /** An external service: a lumpy cloud. */
    cloud(x, y, w2, h2, { title, body = [], size = 16 } = {}) {
      const bumps = [[0.22, 0.32, 0.22, 0.3], [0.48, 0.22, 0.26, 0.3], [0.76, 0.32, 0.24, 0.3], [0.86, 0.62, 0.16, 0.3], [0.5, 0.72, 0.42, 0.3], [0.13, 0.62, 0.15, 0.28]];
      for (const [cx, cy, rx, ry] of bumps) parts.push(`<ellipse cx="${x + w2 * cx}" cy="${y + h2 * cy}" rx="${w2 * rx}" ry="${h2 * ry}" fill="${PAPER}"/>`);
      let d = "";
      for (const [cx, cy, rx, ry] of bumps) d += oval(x + w2 * cx, y + h2 * cy, w2 * rx, h2 * ry, 1);
      stroke(d, 1.8, ' stroke-opacity="0.75"');
      for (const [cx, cy, rx, ry] of bumps) parts.push(`<ellipse cx="${x + w2 * cx}" cy="${y + h2 * cy}" rx="${w2 * rx - 3}" ry="${h2 * ry - 3}" fill="${PAPER}"/>`);
      c.text(x + w2 / 2, y + h2 * 0.42, title, { size: 21, bold: true, anchor: "middle" });
      c.lines(x + w2 / 2, y + h2 * 0.42 + 24, body, { size, anchor: "middle" });
      return box(x, y, w2, h2);
    },
    /** A connector along points, with an arrowhead at the end (or both ends). */
    arrow(pts, { label, at = 0.5, dx = 0, dy = -8, sw = 2, dash = null, both = false, size = 16, anchor = "middle", labelBg = true } = {}) {
      let d = "";
      for (let i = 1; i < pts.length; i++) d += tight(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      const head = (p, q) => {
        const ang = Math.atan2(p[1] - q[1], p[0] - q[0]), L = 13;
        return wob(p[0], p[1], p[0] - L * Math.cos(ang - 0.42), p[1] - L * Math.sin(ang - 0.42), 0.5) + wob(p[0], p[1], p[0] - L * Math.cos(ang + 0.42), p[1] - L * Math.sin(ang + 0.42), 0.5);
      };
      d += head(pts[pts.length - 1], pts[pts.length - 2]);
      if (both) d += head(pts[0], pts[1]);
      stroke(d, sw, dash ? ` stroke-dasharray="${dash}"` : "");
      if (label) {
        // label at a fraction of the total length
        const segs = pts.slice(1).map((p, i) => [pts[i], p, Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])]);
        let want = segs.reduce((s, g) => s + g[2], 0) * at, lx = pts[0][0], ly = pts[0][1];
        for (const [a, b, L] of segs) { if (want <= L) { lx = a[0] + (b[0] - a[0]) * (want / L); ly = a[1] + (b[1] - a[1]) * (want / L); break; } want -= L; }
        const labels = Array.isArray(label) ? label : [label];
        labels.forEach((s, i) => {
          const y = ly + dy + i * size * 1.15;
          if (labelBg) {
            const tw = s.length * size * 0.44 + 10;
            const bx = anchor === "middle" ? lx + dx - tw / 2 : anchor === "end" ? lx + dx - tw + 5 : lx + dx - 5;
            parts.push(`<rect x="${f(bx)}" y="${f(y - size * 0.85)}" width="${f(tw)}" height="${f(size * 1.12)}" rx="4" fill="${PAPER}" fill-opacity="0.92"/>`);
          }
          c.text(lx + dx, y, s, { size, anchor });
        });
      }
    },
    /** A numbered step badge. */
    badge(x, y, n, r = 15) {
      parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${PAPER}"/>`);
      stroke(oval(x, y, r, r, 0.6), 2);
      c.text(x, y + 6, String(n), { size: 19, bold: true, anchor: "middle" });
    },
    note(x, y, w2, list, { size = 16 } = {}) {
      const h2 = list.length * size * 1.22 + 28 + size * 0.3;
      c.box(x, y, w2, h2, { body: list, size, sw: 1.4, dash: "6 6", r: 6, pad: 14 });
      return h2;
    },
    stroke,
    svg() {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><style>${FONT_CSS}</style></defs>
<rect width="${w}" height="${h}" fill="${PAPER}"/>
${parts.join("\n")}
</svg>`;
    },
  };
  if (title) {
    c.text(40, 62, title, { size: 44, bold: true });
    stroke(wob(40, 76, 40 + title.length * 19, 74, 1.4), 2.4);
    if (subtitle) c.text(40, 108, subtitle, { size: 21, opacity: 0.85 });
  }
  return c;
}
/** Handy edge points of a box. */
function box(x, y, w, h) {
  return { x, y, w, h, top: (t = 0.5) => [x + w * t, y], bottom: (t = 0.5) => [x + w * t, y + h], left: (t = 0.5) => [x, y + h * t], right: (t = 0.5) => [x + w, y + h * t] };
}

// ================================================================= 1. system architecture
function system() {
  const c = canvas("system", 1900, 1300, "In This Town: the whole system", "Riders' devices and the kiosk in each car all talk to one Cloudflare Worker on one HTTPS origin, husshusshuss.boston.");
  // devices
  c.text(60, 170, "IN THE TRAIN CAR", { size: 20, bold: true, opacity: 0.7 });
  const phone = c.box(60, 190, 330, 150, { title: "Rider's phone", body: ["phone-web (React + Vite), served at /", "onboarding, Ride Mode, NFC landing", "/k/:car, games seat /m, passport"] });
  const glasses = c.box(60, 380, 330, 140, { title: "Meta Ray-Ban Display", body: ["glasses-web, 600x600 HUD at /g/", "match card, where to go, games", "zero input needed (no Neural Band)"] });
  const screen = c.box(60, 560, 330, 130, { title: "Kiosk screen", body: ["kiosk-web in Chromium kiosk mode", "/kiosk/:car  (public: first names only)"] });
  const pi = c.box(60, 730, 330, 150, { title: "Kiosk Pi agent", body: ["Python 3.11 on a Raspberry Pi", "drives the LED strip (pair color)", "rewrites the NFC tag each mission"] });
  const tag = c.box(450, 840, 150, 80, { title: "NFC tag", body: ["/k/1412?n=…"], titleSize: 20, size: 15, center: true });
  const leds = c.box(450, 950, 150, 70, { title: "LED strip", body: ["WS2812B"], titleSize: 20, size: 15, center: true });
  c.arrow([pi.right(0.75), [420, pi.y + 112], [420, tag.top()[1] + 30], tag.left()], { label: "I2C", at: 0.55, dx: 22, dy: 0, anchor: "start" });
  c.arrow([[pi.x + 120, pi.y + pi.h], [pi.x + 120, leds.y + 35], leds.left()], { label: "GPIO18 data", at: 0.7, dy: -10 });
  c.arrow([tag.top(0.3), [tag.x + 45, phone.y + 120], phone.right(0.8)], { label: ["tap: phone opens", "/k/:car"], at: 0.12, dx: 68, dy: -40, dash: "7 6" });

  // the worker
  c.text(700, 170, "CLOUDFLARE", { size: 20, bold: true, opacity: 0.7 });
  const worker = c.box(700, 190, 560, 690, { title: "Worker  \"questline\"", body: [], hatch: true, sw: 3, titleSize: 30 });
  c.text(720, 262, "one origin, one deploy (Hono)", { size: 18, opacity: 0.8 });
  const assets = c.box(730, 285, 500, 95, { title: "Static assets", body: ["/  ·  /g/  ·  /kiosk/  ·  /m   (SPA fallback per prefix)"], titleSize: 20 });
  const rest = c.box(730, 395, 500, 120, { title: "REST  /api/*", body: ["auth · users · glasses · taps · ride · passport", "report/unblock · game rooms · demo · health", "rate limits per IP · bearer tokens · ErrorRes"], titleSize: 20, size: 16 });
  const ws = c.box(730, 530, 500, 80, { title: "WebSockets", body: ["/ws/rider?token=   ·   /ws/kiosk/:car?key=&role="], titleSize: 20, size: 16 });
  const train = c.box(730, 640, 225, 210, { title: "TrainRoom", body: ["Durable Object", "one per MBTA trip", "riders, pairs, missions,", "kiosks, alarm loop,", "matching"], titleSize: 22, size: 16, sw: 2.6 });
  const game = c.box(1035, 640, 195, 210, { title: "GameRoom", body: ["Durable Object", "one per 4-digit code", "seats a / b, polling,", "the three games"], titleSize: 22, size: 16, sw: 2.6 });
  c.arrow([ws.bottom(0.25), train.top(0.5)], { label: "upgrade → room", at: 0.5, dx: 70, dy: 6 });
  c.arrow([train.right(0.3), game.left(0.3)], { label: "opens", at: 0.5, dy: -10, size: 15 });
  c.arrow([game.left(0.7), train.right(0.7)], { label: "gamesDone", at: 0.5, dy: 24, size: 15 });

  // device wires
  c.arrow([phone.right(0.35), [560, phone.y + 52], [560, rest.y + 25], [730, rest.y + 25]], { label: ["HTTPS REST", "+ WSS /ws/rider"], at: 0.12, dx: 0, dy: -14, both: true });
  c.arrow([glasses.right(0.55), [600, glasses.y + 77], [600, ws.y + 30], ws.left(0.4)], { label: ["poll /api/ride/state", "or WSS, /api/game"], at: 0.62, dx: 12, dy: -30, anchor: "start", both: true });
  c.arrow([screen.right(0.5), [640, screen.y + 65], [640, ws.y + 60], ws.left(0.75)], { label: "WSS role=screen", at: 0.3, dx: 30, dy: -10, both: true });
  c.arrow([pi.right(0.3), [680, pi.y + 45], [680, train.y + 170], train.left(0.8)], { label: ["WSS role=pi", "nfc.write ⇄ written"], at: 0.35, dx: -10, dy: -14, both: true });

  // storage + external
  c.text(1330, 170, "DATA + SERVICES", { size: 20, bold: true, opacity: 0.7 });
  const d1 = c.cyl(1320, 190, 250, 230, { title: "D1  (SQLite)", body: ["users · sessions · checkins", "matches · stamps · met_pairs", "blocks · reports · login codes", "rate_limits"] });
  const r2 = c.cyl(1640, 190, 230, 160, { title: "R2", body: ["questline-media", "the waiting song"] });
  const mbta = c.cloud(1300, 470, 280, 170, { title: "MBTA V3 API", body: ["vehicles · predictions", "schedules"] });
  const claude = c.cloud(1630, 380, 250, 190, { title: "Claude API", body: ["\"why you two\" line", "trivia wrong answers"] });
  const email = c.cloud(1630, 620, 250, 160, { title: "Email Sending", body: ["6-digit sign-in codes"] });
  c.arrow([rest.right(0.2), [1290, rest.y + 24], [1290, 330], d1.left(0.6)], { label: "SQL", at: 0.8, dy: -8, both: true });
  c.arrow([[1230, 300], [1300, 300], [1300, 140], [1755, 140], r2.top()], { label: "/sounds/* fallback", at: 0.55, dy: -8, size: 15 });
  c.arrow([rest.right(0.6), [1605, rest.y + 72], [1605, claude.y + 95], claude.left(0.5)], { label: "why line ≤1.5 s, else template", at: 0.3, dy: -8, size: 14 });
  c.arrow([rest.right(0.9), [1275, rest.y + 108], [1275, 700], email.left(0.5)], { label: "send_email binding", at: 0.72, dy: -8, size: 14 });
  c.arrow([[worker.x + worker.w, 760], [1288, 760], [1288, 580], mbta.left(0.65)], { label: ["TrainRoom polls", "live trips, 20 s"], at: 0.45, dx: 8, dy: 0, size: 14, anchor: "start" });

  // shipping
  c.text(700, 935, "SHIPPING", { size: 20, bold: true, opacity: 0.7 });
  const gh = c.box(700, 955, 260, 120, { title: "GitHub  main", body: ["teammates + agents", "push here"] });
  const ci = c.box(1010, 955, 360, 150, { title: "GitHub Actions CI", body: ["typecheck · build · 450+ tests", "kiosk-pi pytest + shellcheck", "smoke: games-only + missions"] });
  const build = c.box(1420, 955, 420, 150, { title: "Cloudflare auto-deploy", body: ["every push to main goes live", "GET /api/health → versionId,", "deployedAt, gamesOnly"] });
  c.arrow([gh.right(0.4), ci.left(0.4)], { label: "on push / PR", at: 0.5, dy: -8, size: 15 });
  c.arrow([[gh.x + 130, gh.y + gh.h], [gh.x + 130, 1160], [build.x + 210, 1160], build.bottom()], { label: "on push to main", at: 0.5, dy: -8, size: 15 });
  c.arrow([build.top(0.2), [build.x + 84, 905], [1150, 905], [1150, worker.y + worker.h]], { label: "new version", at: 0.55, dy: -8, size: 15 });
  c.note(60, 1080, 560, ["No native app, no camera, no mic, no GPS, no BLE.", "Location only comes from tapping a kiosk's NFC tag.", "Ride Mode on is the consent: no accept step per match."]);
  return c;
}

// ================================================================= 2. request routing
function routing() {
  const c = canvas("routing", 1800, 1180, "One origin: how a request is routed", "Every client (phone, glasses, kiosk screen, Pi) hits the same Worker. apps/worker/src/index.ts decides where it goes.");
  const inb = c.box(50, 470, 250, 170, { title: "Request", body: ["https://husshusshuss", ".boston/…", "(or :8787 in dev)"], center: true, sw: 2.6 });
  const mw = c.box(370, 400, 270, 310, { title: "Middleware", body: ["limitByIp (no-token routes,", "x-kiosk-key skips)", "", "requireRider: bearer token", "→ sessions (hash)", "fails per IP are capped", "", "onError: JSON log line,", "client gets requestId"], hatch: true, size: 16 });
  c.arrow([inb.right(), mw.left(0.53)], { label: "path?", at: 0.5, dy: -10 });
  const rows = [
    ["/ , /k/:car , /passport , /m …", "phone-web SPA", "rider app; /k/:car is the NFC landing; /m is a game seat"],
    ["/g/*", "glasses-web SPA", "/g/?ride = ride HUD, /g/ = games on the lens"],
    ["/kiosk/*", "kiosk-web SPA", "/kiosk/:car?key=… on the Pi's Chromium"],
    ["/api/health", "{ ok, gamesOnly, demoMode, versionId, deployedAt }", "which flow and version are live"],
    ["/api/auth · /users · /me", "auth + users routes", "email code, guest, profile, add an email, delete"],
    ["/api/taps · /ride/*", "taps + ride routes → TrainRoom", "check in, move car, Not now, arrived, ghost, end"],
    ["/api/game/rooms/*", "game routes → GameRoom", "create · join · view (poll) · act · lens"],
    ["/api/passport · /report", "passport + safety", "stamps, recent matches, report, block, unblock"],
    ["/ws/rider?token=", "→ active check-in → TrainRoom(trip)", "409 if not riding; snapshot after rider.hello"],
    ["/ws/kiosk/:car?key=&role=", "→ car → trip → TrainRoom", "screen or pi; 4002 when the trip changes"],
    ["/sounds/waiting.m4a", "asset, else R2 bucket MEDIA", "range requests for iOS"],
    ["anything else under /api", "404  { error: \"not found\" }", "every error body is an ErrorRes"],
  ];
  const x0 = 720, y0 = 160, rowH = 80;
  rows.forEach(([path, to, why], i) => {
    const y = y0 + i * rowH;
    const b = c.box(x0, y, 330, 60, { body: [path], size: 18, r: 10, sw: 1.6, pad: 14 });
    c.box(1110, y, 650, 60, { title: to, body: [], titleSize: 19, r: 10, sw: 2, pad: 14 });
    c.text(1126, y + 52, why, { size: 15, opacity: 0.8 });
    c.arrow([[640, 555], [680, 555], [680, y + 30], [x0, y + 30]], { sw: 1.4 });
    c.arrow([[x0 + 330, y + 30], [1110, y + 30]], { sw: 1.6 });
  });
  c.note(50, 760, 590, ["Static first: a request for a real file is served from", "the assets binding before any route runs. A path with no", "extension that 404s gets its prefix's SPA shell, so", "client routes like /k/1412 and /passport/map work on reload.", "", "No CORS: every client is same-origin; the Vite dev", "servers proxy /api and /ws to :8787."]);
  return c;
}

// ================================================================= 3. ride sequence
function rideFlow() {
  const c = canvas("ride-flow", 1900, 1820, "A ride, end to end (games-only, the demo setting)", "Who sends what, in order. Ride Mode on is the consent: no accept step. Mission mode (GAMES_ONLY=false) differs at step 7.");
  const lanes = [["Rider's phone", "+ glasses"], ["Worker", "/api"], ["TrainRoom", "(this trip)"], ["Kiosk 1413", "screen + Pi"], ["GameRoom", "(pair's code)"], ["Partner", "(Rae)"]];
  const xs = [170, 470, 770, 1100, 1420, 1720];
  lanes.forEach(([a, b], i) => {
    c.box(xs[i] - 125, 140, 250, 90, { title: a, body: [b], center: true, titleSize: 23, sw: 2.4, hatch: i === 2 });
    c.stroke(wob(xs[i], 235, xs[i], 1640, 1), 1.4, ' stroke-dasharray="3 9"');
  });
  let y = 290;
  // Badge just left of the leftmost lane of the message; label starts just right of it.
  const step = (n, from, to, label, opts = {}) => {
    const x1 = xs[from], x2 = xs[to], lo = Math.min(x1, x2);
    c.badge(lo - 34, y, n);
    if (from === to) {
      const right = x1 < 1000;
      const lx = right ? x1 + 104 : x1 - 56;
      c.arrow([[x1, y], [x1 + 90, y], [x1 + 90, y + 34], [x1 + 4, y + 34]], {});
      c.text(lx, y + 6, label, { size: 16, anchor: right ? "start" : "end" });
      y += 92;
    } else {
      c.arrow([[x1 + (x2 > x1 ? 6 : -6), y], [x2 + (x2 > x1 ? -6 : 6), y]], { dash: opts.dash });
      c.text(lo + 14, y - 10, label, { size: 16 });
      y += 70;
    }
  };
  step(1, 0, 1, "tap the car-1412 tag → opens /k/1412, picks a stop, confirms");
  step(2, 1, 2, "POST /api/taps { car, destination, rideMode: true } → checkIn");
  step(3, 2, 0, "ride.state riding · ride.snapshot (phone + glasses sockets)");
  step(4, 5, 2, "Rae checks in on car 1413 the same way");
  step(5, 2, 2, "runMatching: pool → gate → score → greedy → meeting point");
  step(6, 2, 0, "match.found { partner, why, meetAtCar 1413, carDelta +1, game }");
  step(6, 2, 3, "pair.incoming → screen shows Sam & Rae · LEDs glow the pair color", { at: 0.5 });
  step(6, 2, 5, "match.found (she stays put: boarded last)");
  step(7, 0, 3, "walk one car forward, tap the 1413 tag (= arrived)", { dash: "8 6" });
  step(8, 2, 3, "pair.incoming arrived 2 of 2: \"play on your phones or glasses\"");
  step(9, 0, 4, "open /m?code&seat (or the lens takes the seat)", { dash: "8 6" });
  step(9, 5, 4, "polls view(seat b) every 700 ms");
  step(10, 4, 4, "Tall tale → First impressions → Left for you (both vote to go on)");
  step(11, 4, 2, "gamesDone(matchId)");
  step(12, 2, 0, "stamp.awarded (both) → stamp screen + passport");
  step(12, 2, 3, "celebrate → \"Stamped!\" → pair.cleared: kiosk is free");
  step(13, 2, 2, "rest both riders 90 s, then they can be matched again");
  c.note(1270, 1665, 600, ["Mission mode instead: arriving starts a curated mission,", "the Pi writes a fresh ?n= nonce to the tag (nfc.write),", "both tap within the window → stamp. Missions end", "30 s before the next stop; riders leave at their stop."]);
  c.note(40, 1665, 640, ["Glasses link before the ride; once a poll sees the rider", "checked in they open a socket. A stamp missed while the", "page was hidden comes back in ride.snapshot.recentStamp."]);
  return c;
}

// ================================================================= 4. matching
function matching() {
  const c = canvas("matching", 1900, 960, "Matching: who gets paired, and where they meet", "TrainRoom runs this whenever the rider set changes (check-in, check-out, Not now, a pair ending) and on its alarm.");
  const st = [
    ["1  Pool", ["checked in on this trip", "not ghost, not paired", "not cooling after Not now", "not resting (90 s after games)", "has stops left*"]],
    ["2  Gate", ["≥ 1 shared interest", "no block either way", "not met in the last 7 days*", "not declined this trip", "(a report adds a decline)"]],
    ["3  Score", ["closest car first", "then interests: shared tags", "+ ask-me-about overlap", "then social battery", "then novelty 1/(1+timesMet)"]],
    ["4  Greedy", ["best-scoring pair first,", "lock both riders, repeat", "one partner at a time", "one pair per kiosk", "(a kiosk has one tag)"]],
    ["5  Meet point", ["same car: nobody walks", "more stops left stays put", "tie: later check-in stays", "busy kiosk: the other car", "carDelta: + is forward"]],
  ];
  const w = 320, gap = 50, x0 = 50, y0 = 170;
  st.forEach(([t, body], i) => {
    const x = x0 + i * (w + gap) - (i ? 0 : 0);
    c.box(x, y0, w, 210, { title: t, body, size: 18, titleSize: 25, hatch: i === 2, sw: 2.4 });
    if (i < st.length - 1) c.arrow([[x + w + 4, y0 + 105], [x + w + gap - 4, y0 + 105]], { sw: 2.4 });
  });
  const out = c.box(380, 520, 700, 210, { title: "Pair", body: ["pair color (free colors first)", "why line: Claude, one line from shared tags, ≤ 1.5 s;", "  else the template \"You both like ramen and film\"", "a GameRoom code + seat per rider", "autoStart (mission mode) · arrived list"], size: 18, sw: 2.8 });
  c.arrow([[x0 + 4 * (w + gap) + w / 2, y0 + 210], [x0 + 4 * (w + gap) + w / 2, 460], [730, 460], out.top(0.5)], { label: "for each proposed pair", at: 0.55, dy: -10 });
  const phone = c.box(1180, 500, 330, 110, { title: "match.found", body: ["→ both riders' phone + glasses"], size: 17 });
  const kiosk = c.box(1180, 640, 330, 110, { title: "pair.incoming", body: ["→ kiosk at meetAtCar (LEDs)"], size: 17 });
  const db = c.cyl(1580, 500, 270, 250, { title: "D1", body: ["matches row", "met_pairs++", "(lifetime novelty)"] });
  c.arrow([out.right(0.25), phone.left()], {});
  c.arrow([out.right(0.75), kiosk.left()], {});
  c.arrow([out.right(0.5), [1545, 625], db.left(0.5)], { label: "written", at: 0.86, dy: -10, size: 15 });
  c.note(50, 780, 1100, ["* GAMES_ONLY (D26, the demo default) ignores stops: anyone on the train can be matched and a game never ends at a stop.", "* DEMO_MODE ignores \"met in the last 7 days\" so rehearsals can pair the same people again.", "Tests: apps/worker/test/{pool,score,pair}.test.ts"]);
  return c;
}

// ================================================================= 5. data model
function dataModel() {
  const c = canvas("data-model", 1900, 1300, "Data: D1 tables and Durable Object state", "D1 keeps durable records. Live state (who is on the train, current pairs, game boards) lives in Durable Objects.");
  const T = (x, y, name, cols, w = 300, opts = {}) => {
    const h = 58 + cols.length * 24;
    const b = c.box(x, y, w, h, { title: name, body: cols, size: 17, titleSize: 22, sw: 2.2, r: 10, ...opts });
    c.stroke(wob(x + 10, y + 46, x + w - 10, y + 46, 0.8), 1.2);
    return b;
  };
  const users = T(780, 170, "users", ["id  PK", "first_name, interests (3..5)", "ask_me_about, social_battery", "status, languages, ghost", "email  UNIQUE (null = guest)", "created_at"], 340, { hatch: true });
  const sessions = T(1240, 170, "sessions", ["token_hash  PK", "user_id → users", "client  phone | glasses", "last_seen_at (≤ 1 per 10 min)", "revoked_at"], 330);
  const glasses = T(1240, 400, "glasses_codes", ["code (4 digits)", "poll_secret_hash", "user_id, linked_at", "claimed_at, expires_at"], 330);
  const login = T(1620, 170, "login_codes", ["email  PK", "code_hash (sha256)", "attempts ≤ 5", "sent_at, expires_at"], 250);
  const tickets = T(1620, 380, "signup_tickets", ["ticket_hash", "email, expires_at", "used_at"], 250);
  const checkins = T(60, 170, "checkins", ["id  PK", "user_id → users", "trip_id, line, car", "boarded_stop", "destination_stop", "checked_in/out_at", "checkout_reason"], 320);
  const matches = T(420, 520, "matches", ["id  PK", "trip_id, line", "user_a, user_b → users", "pair_key, color", "meet_at_car, walker_id", "shared_tags, why", "end_reason"], 320);
  const sessionsM = T(60, 620, "mission_sessions", ["id  PK", "match_id → matches", "template_id (deck or", "  games-playlist)", "car, station", "end_reason"], 320);
  const stamps = T(420, 920, "stamps", ["id  PK", "user_id → users", "match_id, session_id", "station_id (catalog)", "partner_first_name", "rare, awarded_at"], 320);
  const met = T(860, 640, "met_pairs", ["user_a, user_b  PK", "first/last_met_at", "times_met"], 290);
  const blocks = T(860, 860, "blocks", ["blocker_id → users", "blocked_id → users", "created_at"], 290);
  const reports = T(860, 1050, "reports", ["reporter_id → users", "reported_user_id → users", "match_id → matches", "reason, blocked"], 290);
  const rl = T(1240, 620, "rate_limits", ["key (bucket:ip)", "window_start, count"], 330);
  const rel = (a, b, lab, opts = {}) => c.arrow([a, b], { label: lab, size: 15, sw: 1.6, ...opts });
  rel(sessions.left(0.3), users.right(0.3), "1 : many");
  rel(glasses.left(0.4), [users.x + users.w, users.y + users.h - 20], "links a user", { at: 0.4 });
  rel(checkins.right(0.25), users.left(0.25), "many : 1");
  rel(matches.top(0.6), [users.x + 60, users.y + users.h], "2 riders", { at: 0.5, dx: -40 });
  rel(sessionsM.right(0.3), [matches.x, matches.y + 60], "many : 1", { at: 0.35, dx: -34, dy: -2 });
  rel(stamps.top(0.5), matches.bottom(0.5), "match + session", { at: 0.5, dx: 70 });
  rel(met.top(0.3), [users.x + 200, users.y + users.h], "pairs of users", { at: 0.55, dx: 40 });
  rel(tickets.top(0.5), login.bottom(0.5), "a verified new email");
  // durable objects
  const dox = 1240, doy = 860;
  c.box(dox, doy, 620, 360, { title: "Durable Object storage", body: [], titleSize: 24, sw: 2.6, dash: "10 6" });
  c.box(dox + 20, doy + 60, 280, 280, { title: "TrainRoom (per trip)", body: ["riders: car, stops, ghost,", "  notNowUntil, restUntil,", "  metCounts, blocked", "pairs: color, meetAtCar,", "  arrived, gameCode", "missions, kiosk hw,", "declinedPairs, whyCache,", "timeline (stops, ETA)"], size: 16, titleSize: 19 });
  c.box(dox + 320, doy + 60, 280, 280, { title: "GameRoom (per code)", body: ["seats a / b, last poll", "current game module state", "votes (next / again /", "  finish), lens + moved", "6 h idle → deleteAll", "", "shared: Left for you", "  questions (≤ 30, D27)"], size: 16, titleSize: 19 });
  return c;
}

// ================================================================= 6. kiosk hardware
function hardware() {
  const c = canvas("kiosk-hardware", 1900, 1290, "Kiosk hardware: one per train car", "Raspberry Pi 4 (or 5) + 7\" touchscreen + WS2812B strip + dynamic NFC tag, on a power bank. Pins are physical header pins.");
  const wire = (pts, label, opts = {}) => c.arrow(pts, { label, size: 16, dy: -8, ...opts });
  // the Pi and its header
  c.box(60, 190, 460, 620, { title: "Raspberry Pi 4", body: ["Pi 5: data on GPIO10 (pin 19, SPI)", "with leds.driver = neopixel_spi"], hatch: true, sw: 3, titleSize: 30 });
  c.box(300, 330, 200, 450, { title: "header", body: [], titleSize: 18, r: 6, sw: 1.8 });
  const pins = [["1", "3V3"], ["2", "5V"], ["3", "GPIO2 SDA"], ["4", "5V"], ["5", "GPIO3 SCL"], ["6", "GND"], ["9", "GND"], ["12", "GPIO18"], ["14", "GND"]];
  const py = {};
  pins.forEach(([n, name], i) => {
    const y = 390 + i * 44; py[n] = y;
    c.stroke(oval(318, y, 7, 7, 0.4), 1.6);
    c.text(334, y + 6, `${n}  ${name}`, { size: 17 });
  });

  // NFC tag: wires leave the header on the left, one lane each, down to the tag
  const nfc = c.box(60, 900, 460, 200, { title: "Dynamic NFC tag (I2C)", body: ["ST25DV16K at 0x53 / 0x57, or NTAG I2C plus 0x55", "3.3 V only. The agent rewrites it per mission", "with /k/:car?n=<nonce>, then reads it back."], sw: 2.6, size: 16 });
  const lanes = [["1", 110, "3V3"], ["3", 150, "SDA"], ["5", 190, "SCL"], ["9", 230, "GND"]];
  for (const [n, x, lab] of lanes) {
    c.stroke(tight(311, py[n], x, py[n]) + tight(x, py[n], x, 893), 2);
    c.stroke(wob(x - 6, 885, x, 896, 0.3) + wob(x + 6, 885, x, 896, 0.3), 2);
    c.text(x + 7, 862, lab, { size: 15 });
  }

  // level shifter: wires leave the header on the right
  const chip = c.box(760, 540, 230, 270, { title: "74AHCT125", body: ["3.3 V → 5 V data"], titleSize: 22, sw: 2.6, r: 8, size: 16 });
  const cpin = (x, y, lab, right = false) => { c.stroke(oval(x, y, 6, 6, 0.3), 1.6); c.text(right ? x - 12 : x + 14, y + 6, lab, { size: 16, anchor: right ? "end" : "start" }); };
  cpin(760, 640, "14 VCC"); cpin(760, 690, "2  1A in"); cpin(760, 740, "7 GND"); cpin(990, 690, "3  1Y out", true);
  c.text(776, 790, "1OE → GND · 2-4OE → 5 V", { size: 14, opacity: 0.8 });
  wire([[500, py["4"]], [720, py["4"]], [720, 640], [754, 640]], "5 V", { at: 0.15 });
  wire([[500, py["12"]], [640, py["12"]], [640, 690], [754, 690]], "data (PWM)", { at: 0.2 });
  wire([[500, py["14"]], [754, 740]], "GND", { at: 0.3 });

  // resistor into the strip
  const rx = 1030, ry = 690;
  c.stroke(tight(990, ry, rx, ry) + `M${rx} ${ry}` + [0, 1, 2, 3, 4, 5].map((k) => `L${rx + 8 + k * 14} ${ry + (k % 2 ? 12 : -12)}`).join("") + `L${rx + 92} ${ry}` + tight(rx + 92, ry, 1150, ry), 2.2);
  c.text(rx + 46, ry - 24, "330 Ω", { size: 19, bold: true, anchor: "middle" });
  c.box(1150, 600, 690, 150, { title: "WS2812B strip  ·  30 LEDs, 5 V", body: [], titleSize: 21, sw: 2.6 });
  for (let k = 0; k < 13; k++) c.stroke(oval(1230 + k * 46, 700, 13, 13, 0.6), 1.6);
  c.text(1160, 690, "DIN", { size: 15, bold: true });
  // capacitor across the strip's 5 V / GND
  const capx = 1620;
  c.stroke(wob(capx, 750, capx, 800) + wob(capx - 26, 800, capx + 26, 800) + wob(capx - 26, 814, capx + 26, 814) + wob(capx, 814, capx, 850), 2.2);
  c.text(capx + 40, 812, "1000 µF across 5 V / GND", { size: 18, bold: true });

  // power
  const pb = c.box(1150, 900, 690, 200, { title: "Power bank  20,000 mAh", body: ["port 1 → Pi USB-C (5 V, 3 A)", "port 2 → strip 5 V + GND via a USB pigtail, never the Pi's 5 V pin", "budget: Pi ~1 A, screen ~0.5 A, LEDs ~0.5 A at brightness 0.4"], sw: 2.6, size: 16 });
  wire([pb.top(0.2), [1288, 750]], "port 2: 5 V + GND", { at: 0.5, dx: 12, dy: 6, anchor: "start" });
  wire([pb.bottom(0.15), [1253, 1140], [560, 1140], [560, 760], [526, 760]], "port 1 → USB-C", { at: 0.25 });

  // touchscreen
  const scr = c.box(760, 900, 340, 200, { title: "7\" touchscreen", body: ["DSI ribbon for the picture", "power: pins 4 (5V) + 6 (GND)", "Chromium kiosk mode", "→ /kiosk/:car"], size: 16 });
  wire([[470, 810], [470, 850], [930, 850], scr.top(0.5)], "DSI", { at: 0.55 });

  c.note(60, 1170, 1780, ["One shared ground: Pi GND, shifter GND, strip GND and the power bank GND, or the data line won't work.   Pi 4 + GPIO18: the agent runs as root (PWM uses /dev/mem) and dtparam=audio=off.", "Agent: python -m questline_kiosk  (systemd units in apps/kiosk-pi/systemd; --fake runs it on a laptop with fake LEDs and a fake tag). Full wiring table: docs/hardware.md"]);
  return c;
}

// ================================================================= 7. identity
function identity() {
  const c = canvas("identity", 1900, 1110, "Identity: accounts, guests and glasses", "No passwords. A rider is a bearer token (sha256 in sessions). Any 401 on a signed-in request signs the phone out.");
  const col = (x, title) => { c.box(x, 160, 560, 70, { title, body: [], titleSize: 26, center: true, hatch: true, sw: 2.6 }); };
  col(50, "Email account");
  col(670, "Guest: \"Just play today\"");
  col(1290, "Glasses link (4-digit code)");
  const flow = (x, steps) => {
    let y = 270;
    steps.forEach(([title, body, h = 120], i) => {
      c.badge(x + 20, y + 22, i + 1);
      c.box(x + 50, y, 510, h, { title, body, size: 17, titleSize: 21 });
      if (i < steps.length - 1) c.arrow([[x + 305, y + h + 2], [x + 305, y + h + 38]], { sw: 2 });
      y += h + 40;
    });
  };
  flow(50, [
    ["POST /api/auth/email/start", ["Email Sending sends a 6-digit code", "30 s resend cooldown · 6 / hour / email", "only sha256(email:code) is stored"]],
    ["POST /api/auth/email/verify", ["10 min, 5 wrong tries, single use", "known email → signed-in + token", "new email → signup ticket (30 min)"]],
    ["onboarding (name, interests, battery, rules)", ["POST /api/users { profile, signupTicket }", "→ an account with that email"]],
    ["any phone, any time", ["sign back in with the same code flow", "stamps and people come along"], 100],
  ]);
  flow(670, [
    ["onboarding, no email", ["POST /api/users { profile }", "→ token on this phone only"], 100],
    ["play as usual", ["stamps, people, games all work", "(\"demo: skip setup\" is the same,", " with a pre-filled profile)"]],
    ["Me → Keep your stamps", ["/auth/email/start, then", "POST /api/me/email { email, code }", "409 email-taken · has-email"]],
    ["now an account", ["same profile, stamps and people,", "and a way back in from any phone"], 100],
  ]);
  flow(1290, [
    ["glasses: POST /api/glasses/code", ["→ 4 digits on the lens", "+ a poll secret only the glasses know", "(hash stored; short TTL)"]],
    ["phone: Me → Glasses", ["types the 4 digits", "POST /api/glasses/link (bearer)"], 100],
    ["glasses poll /code/:code?secret=", ["→ { linked: true, token } once", "a second poll or wrong secret → 410", "429 → back off 2 s … 30 s"]],
    ["glasses ride HUD /g/?ride", ["polls /api/ride/state; once checked in", "opens /ws/rider; client = glasses"], 100],
  ]);
  c.note(50, 900, 1800, [
    "Tokens: 32 random bytes, sent as Authorization: Bearer (WebSockets use ?token=). Only sha256(token) is kept, in sessions, with client = phone | glasses.",
    "Delete my data revokes every session and scrubs the profile. Per-IP limits (lib/rateLimit.ts) cover failed tokens and the no-token routes: sign-in, new riders, glasses codes.",
    "The phone treats any 401 on a signed-in request as \"this device is signed out\": it drops the token and the profile and lands on the start page.",
  ]);
  return c;
}

// ================================================================= 8. games
function games() {
  const c = canvas("games", 1900, 1020, "Two-player games: the GameRoom", "Rules are pure modules in packages/protocol/src/games (init · reduce · tick · view). The room only stores state and runs them.");
  const room = c.box(620, 180, 660, 560, { title: "GameRoom  (Durable Object, key = 4-digit code)", body: [], titleSize: 24, hatch: true, sw: 3 });
  const play = c.box(650, 250, 600, 200, { title: "playlist (D22 · D28 · D29)", body: ["Tall tale  →  First impressions  →  Left for you", "act(seat, action) → module.reduce(state)", "every poll → module.tick(state, now) for timers", "view(seat) only shows that seat's secrets", "Next game / Again / Finish are votes: both must agree"], size: 17 });
  const store = c.box(650, 480, 290, 230, { title: "room state", body: ["seats a / b + last poll", "game index + state", "votes, lens, moved", "pair { tripId, matchId }", "6 h idle → deleteAll"], size: 17 });
  const shared = c.box(960, 480, 290, 230, { title: "shared room", body: ["Left for you questions", "≤ 30, newest first", "q, answer, 3 decoys,", "first names of the", "pair who left it (D27)"], size: 17 });
  const phoneA = c.box(60, 200, 420, 160, { title: "Seat a: phone /m", body: ["GET /api/game/rooms/:code?seat=a", "every 700 ms", "POST …/act { seat, action }"] });
  const lens = c.box(60, 420, 420, 170, { title: "…or on the glasses /g/", body: ["POST …/lens { seat, to: lensCode }", "the glasses poll as that seat;", "the phone shows \"playing on your", "glasses\" and takes typing screens"] });
  const phoneB = c.box(60, 650, 420, 140, { title: "Seat b: partner's phone", body: ["same calls, seat b", "partnerHere = polled recently"] });
  c.arrow([phoneA.right(0.5), [580, 280], [580, 320], play.left(0.35)], { both: true, label: "poll + act", at: 0.2, dy: -8 });
  c.arrow([lens.right(0.5), [560, 505], [560, 360], play.left(0.55)], { both: true, label: "as seat a", at: 0.15, dy: -8, dash: "8 6" });
  c.arrow([phoneB.right(0.5), [600, 720], [600, 410], play.left(0.8)], { both: true, label: "seat b", at: 0.15, dy: -8 });
  const claude = c.cloud(1380, 190, 450, 200, { title: "Claude API (hook)", body: ["pair leaves a question + answer", "→ 3 wrong answers, or rejected", "(off topic, offensive, personal)"] });
  c.arrow([play.right(0.75), [1330, 400], [1330, 300], claude.left(0.6)], { label: "Left for you: writing", at: 0.4, dx: 0, dy: -10, size: 15 });
  c.arrow([[1450, 390], [1450, 600], shared.right(0.5)], { label: "only checked cards", at: 0.4, dx: 0, dy: 0, size: 15 });
  const train = c.box(1380, 760, 450, 200, { title: "TrainRoom (the pair's trip)", body: ["opened this room when it locked the pair", "and put { code, seat } in match.found", "gamesDone → both stamped, kiosk", "celebrates + frees up, 90 s rest (D28)"], sw: 2.6 });
  c.arrow([room.bottom(0.8), [1148, 860], train.left(0.5)], { label: "last game finished, once", at: 0.6, dy: -10 });
  c.arrow([train.left(0.2), [1230, 800], [1230, 746]], { label: "opens the room", at: 0.3, dy: -10, size: 15, dash: "8 6" });
  c.note(60, 840, 1000, ["Polling (not sockets) because WebSockets on the glasses browser are unconfirmed; the code is the only key.", "Every module is tested in packages/protocol/test (tale, impressions, trivia, votes).", "Demo pacing (Kenny): First impressions 2 rounds, Left for you 2 questions; ~2.5 minutes in all."]);
  return c;
}

// ================================================================= 9. ci/cd
function shipping() {
  const c = canvas("ci-cd", 1900, 800, "Shipping: CI and auto-deploy", "main is always live. CI checks every push; Cloudflare builds and deploys main on its own.");
  const dev = c.box(50, 300, 300, 180, { title: "a push to main", body: ["you, Kenny, Andres", "or an agent (Claude, Cursor)", "pull --rebase first"], sw: 2.6, hatch: true });
  const job1 = c.box(470, 170, 560, 150, { title: "CI: typecheck · build · test", body: ["pnpm typecheck · pnpm build · pnpm test", "protocol, worker, phone, glasses, kiosk,", "t-map, start-screen: 450+ node:test cases"], size: 17 });
  const job2 = c.box(470, 345, 560, 110, { title: "CI: kiosk Pi agent", body: ["shellcheck setup.sh · pytest (33 tests)"], size: 17 });
  const job3 = c.box(470, 480, 560, 170, { title: "CI: worker smoke, both modes", body: ["wrangler dev :8787 (games-only) → pnpm smoke", "wrangler dev :8788 --var GAMES_ONLY:false", "→ pnpm smoke (missions, stamps, late bonus)"], size: 17 });
  [job1, job2, job3].forEach((j2) => c.arrow([dev.right(0.5), [410, 390], [410, j2.y + j2.h / 2], j2.left()], { sw: 2 }));
  const deploy = c.box(1150, 300, 330, 180, { title: "Cloudflare build", body: ["builds the web apps,", "deploys the Worker", "(no CI gate: keep main green)"], sw: 2.6 });
  c.arrow([[200, 480], [200, 715], [1090, 715], [1090, 390], deploy.left()], { label: "Workers Builds watches main", at: 0.35, dy: -8 });
  const live = c.box(1560, 300, 290, 180, { title: "husshusshuss.boston", body: ["GET /api/health", "{ versionId, deployedAt,", "  gamesOnly, demoMode }"], sw: 3 });
  c.arrow([deploy.right(), live.left()], { label: "new version", at: 0.5, dy: -10 });
  c.note(1150, 540, 700, ["By hand, not on push:", "· D1 migrations: pnpm db:migrate:remote", "· secrets: wrangler secret put KIOSK_KEY / ANTHROPIC_API_KEY", "· the waiting song: wrangler r2 object put …", "· art and diagrams: pnpm art · pnpm diagrams"]);
  return c;
}

// ---------------------------------------------------------------- write + render
const diagrams = { system, routing, "ride-flow": rideFlow, matching, "data-model": dataModel, "kiosk-hardware": hardware, identity, games, "ci-cd": shipping };
mkdirSync(outDir, { recursive: true });
const only = process.argv[2];
for (const [name, make] of Object.entries(diagrams)) {
  if (only && name !== only) continue;
  const c = make();
  const svgPath = join(outDir, `${name}.svg`);
  writeFileSync(svgPath, c.svg());
  const png = join(outDir, `${name}.png`);
  execFileSync(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2", `--window-size=${c.w},${c.h}`, "--virtual-time-budget=3000", `--screenshot=${png}`, pathToFileURL(svgPath).href], { stdio: "ignore" });
  console.log(`docs/diagrams/${name}.svg + .png  (${c.w}x${c.h})`);
}
