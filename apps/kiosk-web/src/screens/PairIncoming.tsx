/**
 * PairIncoming.tsx (kiosk-web): a pair is heading to this kiosk.
 *
 * Driven by pair.incoming: color (full-screen fill, PAIR_COLOR_HEX, matches the LEDs and
 * the glasses swatch) and firstNames ["Maya", "Andres"] -> "Maya & Andres, meet here".
 * Leaves on mission.show (-> Mission) or pair.cleared (-> Idle).
 *
 * Public screen: first names and color only. pair.incoming carries nothing else, and this
 * component must never be handed interests or the why line.
 *
 * TODO:
 * - Pick text color per pair color for contrast (dark text on yellow/green).
 * - Show "Maya is here" once the worker tells kiosks about rider.arrived (no event yet).
 */
import { PAIR_COLOR_HEX, type PairColor } from "@questline/protocol";

interface PairIncomingProps {
  color: PairColor;
  firstNames: [string, string];
}

export function PairIncoming({ color, firstNames }: PairIncomingProps) {
  return (
    <main className="screen pair" style={{ background: PAIR_COLOR_HEX[color] }}>
      <div className="pair-names">
        {firstNames[0]} &amp; {firstNames[1]}
      </div>
      <div className="pair-sub">meet here</div>
      <div className="pair-color">look for {color}</div>
    </main>
  );
}
