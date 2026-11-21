import type { LineColor, Stamp } from "../../../shared/types";
import { LINES } from "../../../shared/catalog";

// Hand-drawn T map from the H2 hi-fi, in its own 342×150 coordinate space.
// Each line is an ink stroke with the line colour drawn on top.
type Pt = [number, number];
const ROUTES: { line: LineColor; pts: Pt[] }[] = [
  { line: "red", pts: [[114, 4], [180, 70], [202, 92], [258, 148]] },
  { line: "orange", pts: [[240, 0], [236, 14], [224, 26], [224, 70], [202, 92], [160, 134], [146, 148]] },
  { line: "blue", pts: [[184, 30], [202, 48], [224, 70], [250, 60], [326, 8]] },
  // Green: B, C, D branches into Kenmore, E joining at Copley, then the trunk.
  { line: "green", pts: [[10, 84], [40, 84], [66, 100]] },
  { line: "green", pts: [[10, 100], [66, 100]] },
  { line: "green", pts: [[10, 118], [40, 118], [66, 100]] },
  { line: "green", pts: [[70, 132], [100, 132], [130, 100]] },
  { line: "green", pts: [[66, 100], [150, 100], [180, 70], [202, 48], [224, 26], [236, 14]] },
];

/** Where each catalog station sits on the drawing (stations off the sketch are left out). */
const POS: Record<string, { at: Pt; r: number }> = {
  kenmore: { at: [66, 100], r: 8 },
  "bu-east": { at: [28, 84], r: 6 },
  "bu-central": { at: [16, 84], r: 6 },
  hynes: { at: [98, 100], r: 6 },
  copley: { at: [130, 100], r: 6 },
  arlington: { at: [150, 100], r: 6 },
  "park-st": { at: [180, 70], r: 7 },
  "gov-ctr": { at: [202, 48], r: 6 },
  "downtown-crossing": { at: [202, 92], r: 6 },
  harvard: { at: [136, 26], r: 6 },
  aquarium: { at: [270, 46], r: 6 },
};

/** Transfer stations (and the Kenmore junction), drawn as open dots until stamped. */
const INTERCHANGES: { at: Pt; r: number }[] = [
  { at: [66, 100], r: 7 },
  ...([[202, 48], [224, 70], [202, 92], [224, 26], [236, 14]] as Pt[]).map((at) => ({ at, r: 4 })),
];

const LABELS: { text: string; x: number; y: number }[] = [
  { text: "Kenmore", x: 40, y: 64 },
  { text: "Park St", x: 118, y: 62 },
  { text: "Copley", x: 104, y: 82 },
];

const pts = (p: Pt[]) => p.map(([x, y]) => `${x},${y}`).join(" ");
const ORDER: LineColor[] = ["red", "orange", "blue", "green"];

export function TMap({ stamps }: { stamps: Stamp[] }) {
  const stamped = [...new Set(stamps.map((s) => s.stationId))].filter((id) => POS[id]);
  const rare = stamps.filter((s) => s.rare).length;
  const dots = INTERCHANGES.filter(({ at: [x, y] }) => !stamped.some((id) => POS[id].at[0] === x && POS[id].at[1] === y));
  const label = `Map of the T with ${stamps.length} stamped station${stamps.length === 1 ? "" : "s"}`;

  return (
    <svg viewBox="0 0 342 150" role="img" aria-label={label}>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {ROUTES.map((r, i) => (
          <polyline key={`ink${i}`} points={pts(r.pts)} stroke="var(--ink)" strokeWidth={10} />
        ))}
        {ORDER.flatMap((line) =>
          ROUTES.filter((r) => r.line === line).map((r, i) => (
            <polyline key={`${line}${i}`} points={pts(r.pts)} stroke={LINES[line].hex} strokeWidth={6} />
          )),
        )}
      </g>
      <g stroke="var(--ink)" strokeWidth={2}>
        {dots.map(({ at: [x, y], r }) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="var(--paper)" />
        ))}
        {stamped.map((id) => (
          <circle key={id} cx={POS[id].at[0]} cy={POS[id].at[1]} r={POS[id].r - 1} fill="var(--yellow)" />
        ))}
      </g>
      <g fill="var(--ink)" style={{ font: "700 16px var(--font-hand)" }} aria-hidden>
        {LABELS.map((l) => (
          <text key={l.text} x={l.x} y={l.y} dominantBaseline="text-before-edge">
            {l.text}
          </text>
        ))}
        <text x={262} y={80} dominantBaseline="text-before-edge" style={{ font: "400 20px var(--font-display)" }}>
          {stamps.length}
        </text>
        <text x={stamps.length > 9 ? 290 : 280} y={84} dominantBaseline="text-before-edge">
          {stamps.length === 1 ? "stamp" : "stamps"}
        </text>
        {rare > 0 && (
          <text x={262} y={106} dominantBaseline="text-before-edge" fill="var(--brick)">
            {rare} rare ★
          </text>
        )}
      </g>
    </svg>
  );
}
