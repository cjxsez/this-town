/**
 * Celebrate.tsx (kiosk-web): stamp awarded, color burst.
 *
 * Driven by celebrate: color (burst color), rare (gold variant + "Rare stamp!").
 * First names come from the stored pair.incoming for the same matchId.
 * App returns to Idle after CELEBRATE_MS or on pair.cleared, whichever is first.
 *
 * TODO:
 * - Proper burst/confetti animation (CSS only, keep it light for the Pi).
 * - Rare variant art.
 */
import type { CSSProperties } from "react";
import { PAIR_COLOR_HEX, type PairColor } from "@questline/protocol";

interface CelebrateProps {
  color: PairColor;
  rare: boolean;
  firstNames: [string, string] | null;
}

export function Celebrate({ color, rare, firstNames }: CelebrateProps) {
  const style = { "--burst": PAIR_COLOR_HEX[color] } as CSSProperties;
  return (
    <main className={`screen celebrate ${rare ? "is-rare" : ""}`} style={style}>
      <div className="burst" aria-hidden="true" />
      <div className="celebrate-title">{rare ? "Rare stamp!" : "Stamped!"}</div>
      {firstNames && (
        <div className="celebrate-names">
          {firstNames[0]} &amp; {firstNames[1]}
        </div>
      )}
    </main>
  );
}
