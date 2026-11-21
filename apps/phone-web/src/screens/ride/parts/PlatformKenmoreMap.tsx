import type { GreenBranch } from "../../../../shared/types";

// C1's junction map: why the line choice matters at Kenmore, where B, C and D
// share one platform. Drawn as SVG so it scales down on narrow phones.

type Seg = { x1: number; y1: number; x2: number; y2: number };
const BRANCH_TRACKS: Record<"B" | "C" | "D", Seg[]> = {
  B: [
    { x1: 14, y1: 30, x2: 150, y2: 30 },
    { x1: 150, y1: 30, x2: 196, y2: 74 },
  ],
  C: [{ x1: 14, y1: 74, x2: 196, y2: 74 }],
  D: [
    { x1: 14, y1: 120, x2: 150, y2: 120 },
    { x1: 150, y1: 120, x2: 196, y2: 74 },
  ],
};
const TRUNK: Seg = { x1: 196, y1: 74, x2: 322, y2: 74 };

const STOPS: Record<"B" | "C" | "D", [number, number][]> = {
  B: [[150, 30], [112, 30], [74, 30], [40, 30]],
  C: [[104, 74], [60, 74], [150, 74]],
  D: [[104, 120], [60, 120], [150, 120]],
};
const BADGE_Y = { B: 30, C: 74, D: 120 } as const;
const END_LABEL = {
  B: { text: "to Boston College", y: 38 },
  C: { text: "Cleveland Circle", y: 82 },
  D: { text: "Riverside", y: 128 },
} as const;

const INK = "var(--ink)";
const hand = { font: "700 16px var(--font-hand)" };

export function PlatformKenmoreMap({ branch, name }: { branch?: GreenBranch; name: string }) {
  const order: ("B" | "C" | "D")[] = ["B", "C", "D"];
  // Draw the chosen branch last so it sits on top at the junction.
  const drawOrder = [...order.filter((b) => b !== branch), ...order.filter((b) => b === branch)];
  const line = (s: Seg, w: number, color: string, key: string) => (
    <line key={key} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={color} strokeWidth={w} strokeLinecap="round" />
  );
  return (
    <svg viewBox="0 0 334 150" width="100%" style={{ maxWidth: 334, filter: "var(--wob)", overflow: "visible" }} aria-hidden>
      {drawOrder.map((b) => {
        const on = b === branch;
        return BRANCH_TRACKS[b].map((s, i) => line(s, on ? 12 : 10, INK, `o${b}${i}`));
      })}
      {line(TRUNK, 12, INK, "ot")}
      {drawOrder.map((b) => {
        const on = b === branch;
        return BRANCH_TRACKS[b].map((s, i) => line(s, on ? 8 : 6, on ? "var(--green)" : "var(--leaf)", `i${b}${i}`));
      })}
      {line(TRUNK, 8, "var(--green)", "it")}
      {order.map((b) =>
        STOPS[b].map(([x, y], i) => (
          <circle key={`${b}${i}`} cx={x} cy={y} r={b === "B" ? 4 : 3} fill="var(--paper)" stroke={INK} strokeWidth={2} />
        )),
      )}
      <circle cx={262} cy={74} r={4} fill="var(--paper)" stroke={INK} strokeWidth={2} />
      {order.map((b) => {
        const on = b === branch;
        return (
          <g key={b}>
            <circle cx={11} cy={BADGE_Y[b]} r={10} fill={on ? "var(--green-dk)" : "var(--paper)"} stroke={INK} strokeWidth={2} />
            <text
              x={11}
              y={BADGE_Y[b] + 4.5}
              textAnchor="middle"
              fill={on ? "var(--paper)" : INK}
              style={{ font: "400 11px var(--font-display)" }}
            >
              {b}
            </text>
            <text x={28} y={END_LABEL[b].y + 12} fill={on ? INK : "var(--ink-soft)"} style={hand}>
              {END_LABEL[b].text}
            </text>
          </g>
        );
      })}
      <text x={112} y={20} fill={INK} style={hand}>
        Blandford St
      </text>
      <text x={246} y={96} fill={INK} style={hand}>
        Hynes
      </text>
      <text x={236} y={116} fill="var(--ink-soft)" style={hand}>
        to Gov't Ctr →
      </text>
      <circle cx={196} cy={74} r={11} fill="var(--yellow)" stroke={INK} strokeWidth={2} />
      <text x={208} y={56} fill={INK} style={{ font: "400 13px var(--font-display)" }}>
        {name.toUpperCase()}
      </text>
    </svg>
  );
}
