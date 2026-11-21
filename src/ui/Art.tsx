import { useState, type CSSProperties } from "react";
import { BADGE_COLORS } from "../../shared/catalog";
import type { Badge } from "../../shared/types";

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

const LIGHT = new Set(["yellow", "blue"]);

/** The colour-animal token: what a rider looks for on the other person's badge. */
export function AnimalToken({ badge, size = 56, style }: { badge: Badge; size?: number; style?: CSSProperties }) {
  return (
    <div
      className={`q-animal${LIGHT.has(badge.color) ? " q-animal--light" : ""}`}
      style={{ width: size, height: size, background: BADGE_COLORS[badge.color], fontSize: Math.max(9, size / 6), ...style }}
      aria-label={`${badge.color} ${badge.animal}`}
    >
      <ArtSlot
        id={`animal-${badge.color}-${badge.animal}`}
        placeholder={badge.animal}
        round
        style={{ position: "absolute", inset: 0, border: 0, background: "transparent", fontSize: "inherit", color: "inherit", fontFamily: "var(--font-display)", textTransform: "uppercase" }}
      />
    </div>
  );
}
