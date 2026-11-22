import { useState, type CSSProperties } from "react";
import { PAIR_COLOR_HEX } from "@questline/protocol/colors";
import type { PairColor } from "../../shared/types";

/**
 * Placeholder for illustration the art team hasn't delivered yet (the hi-fi
 * file's <image-slot>). Drop a file at public/art/<id>.webp (or .png) and it
 * replaces the dashed box everywhere, no code change needed.
 */
export function ArtSlot({
  id,
  placeholder,
  style,
  round,
  radius = 6,
}: {
  id: string;
  placeholder: string;
  style?: CSSProperties;
  round?: boolean;
  radius?: number;
}) {
  const [src, setSrc] = useState<string | null>(`/art/${id}.webp`);
  const shape: CSSProperties = { borderRadius: round ? "50%" : radius, ...style };
  if (src) {
    return (
      <div className="q-art" style={shape}>
        <img
          src={src}
          alt=""
          onError={() => setSrc(src.endsWith(".webp") ? `/art/${id}.png` : null)}
        />
      </div>
    );
  }
  return (
    <div className="q-art q-art--empty" style={shape} aria-hidden>
      {placeholder}
    </div>
  );
}

const LIGHT = new Set<PairColor>(["yellow", "green", "orange"]);

/**
 * The pair color, with the person's initial: the same color the kiosk LEDs, kiosk screen
 * and glasses show for this match. It's how you recognize each other's kiosk.
 */
export function PairToken({ color, name, size = 56, style }: { color: PairColor; name?: string; size?: number; style?: CSSProperties }) {
  return (
    <div
      className={`q-animal${LIGHT.has(color) ? " q-animal--light" : ""}`}
      style={{
        width: size,
        height: size,
        background: PAIR_COLOR_HEX[color],
        fontSize: Math.max(12, size / 2.4),
        display: "grid",
        placeItems: "center",
        fontFamily: "var(--font-display)",
        ...style,
      }}
      aria-label={name ? `${name}, ${color}` : color}
    >
      {name ? name.slice(0, 1).toUpperCase() : null}
    </div>
  );
}
