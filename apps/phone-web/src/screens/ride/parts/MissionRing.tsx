import { clock } from "../../../state/format";

const SIZE = 190;
const C = SIZE / 2;
const R = 84; // centre of the 20px band
const CIRC = 2 * Math.PI * R;

/**
 * The F1 ring timer: a green band that drains anticlockwise back to 12 o'clock,
 * a yellow knob riding its end, and m:ss big enough to read from waist height.
 */
export function MissionRing({ left, total }: { left: number; total: number }) {
  const frac = total > 0 ? Math.min(1, Math.max(0, left / total)) : 0;
  const up = left <= 0;
  const t = clock(left);
  return (
    <div
      className="mission-ring"
      role="timer"
      aria-label={up ? "Time's up" : `${t} left`}
      style={{ position: "relative", borderRadius: "50%", boxShadow: "3px 5px 0 var(--shadow)", color: "var(--ink)" }}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" height="100%" aria-hidden style={{ overflow: "visible" }}>
        <circle cx={C} cy={C} r={C - 1} fill="var(--paper-lo)" stroke="var(--ink)" strokeWidth={2} />
        <circle
          cx={C}
          cy={C}
          r={R}
          fill="none"
          stroke="var(--green)"
          strokeWidth={19}
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - frac)}
          transform={`rotate(-90 ${C} ${C})`}
          style={{ transition: "stroke-dashoffset .3s linear" }}
        />
        <circle cx={C} cy={C} r={R - 10} fill="var(--paper)" stroke="var(--ink)" strokeWidth={2} />
        {!up && (
          <g style={{ transform: `rotate(${frac * 360}deg)`, transformOrigin: `${C}px ${C}px`, transition: "transform .3s linear" }}>
            <circle cx={C} cy={C - R - 9} r={9} fill="var(--yellow)" stroke="var(--ink)" strokeWidth={2} />
          </g>
        )}
      </svg>
      <div
        aria-hidden
        style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
      >
        <div className="mission-ring__num q-num">{t}</div>
        <div style={{ font: "700 20px/1.08 var(--font-hand)" }}>{up ? "time's up" : "left"}</div>
      </div>
    </div>
  );
}
