/**
 * ColorSwatch.tsx (glasses-web): the pair color, as a solid block with its name.
 *
 * Uses PAIR_COLOR_HEX from @questline/protocol so the glasses, kiosk LEDs and kiosk screen
 * all show the same color ("look for orange"). Color comes from MatchFoundEvent.partner.color.
 *
 * Hexes match the kiosk LEDs; check saturation on the waveguide in daylight if yellow washes out.
 */
import { PAIR_COLOR_HEX, type PairColor } from "@questline/protocol";

interface ColorSwatchProps {
  color: PairColor;
  size?: number;
  showLabel?: boolean;
}

export function ColorSwatch({ color, size = 72, showLabel = true }: ColorSwatchProps) {
  return (
    <span className="swatch">
      <span
        className="swatch-chip"
        style={{ width: size, height: size, background: PAIR_COLOR_HEX[color] }}
        aria-hidden="true"
      />
      {showLabel && (
        <span className="swatch-label" style={{ color: PAIR_COLOR_HEX[color] }}>
          {color}
        </span>
      )}
    </span>
  );
}
