/**
 * PairColorBadge.tsx: the pair's color as a pill ("look for orange").
 *
 * Responsible for: rendering a PairColor with the shared PAIR_COLOR_HEX so the phone matches
 * the kiosk LEDs, the kiosk screen and the glasses exactly.
 *
 * Uses: no routes or events. Fed by match.found partner.color (via useRide).
 *
 * TODO:
 * - Optional pulsing variant while walking to the kiosk.
 * - Check text contrast on yellow/green once real styles land.
 */
import { PAIR_COLOR_HEX, type PairColor } from "@questline/protocol";

interface Props {
  color: PairColor;
  /** Defaults to the color name. */
  label?: string;
}

export function PairColorBadge({ color, label }: Props) {
  return (
    <span className="pair-badge" style={{ background: PAIR_COLOR_HEX[color] }}>
      {label ?? color}
    </span>
  );
}
