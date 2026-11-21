import type { ReactNode } from "react";
import { LINES } from "../../shared/catalog";
import type { LineColor } from "../../shared/types";

export function LinePill({ line, children }: { line: LineColor; children: ReactNode }) {
  return (
    <span className="q-pill">
      <span className="q-pill__dot" style={{ background: LINES[line].hex }} />
      {children}
    </span>
  );
}

/** Dark countdown pill, e.g. "TRAIN 4:10". `warn` is the yellow delayed/arriving variant. */
export function TrainPill({ children, warn }: { children: ReactNode; warn?: boolean }) {
  return (
    <span className={`q-pill q-pill--dark q-num${warn ? " q-pill--warn" : ""}`} style={warn ? { color: "var(--ink)" } : undefined}>
      {children}
    </span>
  );
}
