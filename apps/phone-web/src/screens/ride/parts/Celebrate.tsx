import type { CSSProperties } from "react";
import type { PairColor } from "../../../../shared/types";
import "./celebrate.css";

/** Your match's figure wears their pair colour; orange is yours, so an orange pair gets blue. */
export const friendColor = (color: PairColor | undefined) => (color && color !== "orange" ? color : "blue");

/** Paper confetti that bursts out from the middle of its box. Fixed spread, so every burst looks the same. */
const PIECES = [
  { dx: 123, dy: -43, spin: -442, color: "var(--yellow)", shape: 0, delay: 105 },
  { dx: 138, dy: -17, spin: -422, color: "var(--green)", shape: 2, delay: 27 },
  { dx: 139, dy: -5, spin: -397, color: "var(--red)", shape: 0, delay: 11 },
  { dx: 85, dy: 10, spin: -287, color: "var(--orange)", shape: 0, delay: 80 },
  { dx: 107, dy: 68, spin: 272, color: "var(--blue)", shape: 0, delay: 28 },
  { dx: 85, dy: 69, spin: 53, color: "var(--paper)", shape: 1, delay: 18 },
  { dx: 18, dy: 65, spin: -170, color: "var(--sky)", shape: 0, delay: 74 },
  { dx: -17, dy: 42, spin: -341, color: "var(--yellow)", shape: 2, delay: 91 },
  { dx: -29, dy: 32, spin: -119, color: "var(--green)", shape: 1, delay: 87 },
  { dx: -104, dy: 57, spin: 413, color: "var(--red)", shape: 2, delay: 118 },
  { dx: -101, dy: 20, spin: -172, color: "var(--orange)", shape: 2, delay: 99 },
  { dx: -139, dy: 15, spin: 535, color: "var(--blue)", shape: 1, delay: 112 },
  { dx: -145, dy: -13, spin: -391, color: "var(--paper)", shape: 0, delay: 65 },
  { dx: -179, dy: -38, spin: -229, color: "var(--sky)", shape: 1, delay: 53 },
  { dx: -169, dy: -55, spin: 102, color: "var(--yellow)", shape: 1, delay: 88 },
  { dx: -140, dy: -84, spin: 394, color: "var(--green)", shape: 0, delay: 107 },
  { dx: -109, dy: -91, spin: -407, color: "var(--red)", shape: 0, delay: 93 },
  { dx: -89, dy: -134, spin: 372, color: "var(--orange)", shape: 1, delay: 91 },
  { dx: -65, dy: -143, spin: -494, color: "var(--blue)", shape: 1, delay: 45 },
  { dx: -24, dy: -117, spin: -420, color: "var(--paper)", shape: 0, delay: 98 },
  { dx: 12, dy: -155, spin: 274, color: "var(--sky)", shape: 1, delay: 117 },
  { dx: 51, dy: -108, spin: 379, color: "var(--yellow)", shape: 1, delay: 70 },
  { dx: 64, dy: -108, spin: 341, color: "var(--green)", shape: 2, delay: 35 },
  { dx: 156, dy: -122, spin: 239, color: "var(--red)", shape: 0, delay: 19 },
  { dx: 103, dy: -84, spin: -63, color: "var(--orange)", shape: 0, delay: 62 },
  { dx: 124, dy: -53, spin: 37, color: "var(--blue)", shape: 0, delay: 18 }
];

export function Confetti({ delay = 0, style }: { delay?: number; style?: CSSProperties }) {
  return (
    <div className="q-confetti" aria-hidden style={style}>
      {PIECES.map((p, i) => (
        <span
          key={i}
          className={`q-confetti__bit q-confetti__bit--${p.shape}`}
          style={
            {
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--spin": `${p.spin}deg`,
              "--d": delay + p.delay,
              background: p.color,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/**
 * How far along the line your stamps go: one dot per stop (a bar on long lines), the
 * newest one popping in last.
 */
export function LineProgress({ label, got, total, color, delay = 0 }: { label: string; got: number; total: number; color: string; delay?: number }) {
  // One dot per stop for any line up to 30 stops; past 22 they shrink to fit.
  const dots = total <= 30;
  const dense = total > 22;
  return (
    <div className="q-line-progress" style={{ "--line": color } as CSSProperties}>
      <div className="q-line-progress__label">
        <span>{label}</span>
        <span className="q-num">
          {got} / {total} stops
        </span>
      </div>
      {dots ? (
        <div className={`q-line-progress__dots${dense ? " q-line-progress__dots--dense" : ""}`} aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={i < got ? (i === got - 1 ? "is-on is-new" : "is-on") : undefined}
              style={i === got - 1 ? ({ "--d": delay } as CSSProperties) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="q-line-progress__bar" aria-hidden>
          <span style={{ width: `${(100 * got) / Math.max(1, total)}%` }} />
        </div>
      )}
    </div>
  );
}
