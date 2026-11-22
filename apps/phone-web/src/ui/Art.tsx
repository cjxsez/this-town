import { useState, type CSSProperties } from "react";
import { PAIR_COLOR_HEX } from "@questline/protocol/colors";
import type { PairColor } from "../../shared/types";

/**
 * A picture from public/art/<id>.webp (or .png). The files there are rendered by
 * the start screen's renderer (`pnpm art`); a slot with no file shows a dashed box.
 */
export function ArtSlot({
  id,
  placeholder,
  style,
  round,
  radius = 6,
  fit = "cover",
}: {
  id: string;
  placeholder: string;
  style?: CSSProperties;
  round?: boolean;
  radius?: number;
  /** "cover" fills the box (photos). "contain" shows the whole picture (cut-out art). */
  fit?: "cover" | "contain";
}) {
  const [src, setSrc] = useState<string | null>(`/art/${id}.webp`);
  const shape: CSSProperties = { borderRadius: round ? "50%" : radius, ...style };
  if (src) {
    return (
      <div className={`q-art${fit === "contain" ? " q-art--contain" : ""}`} style={shape}>
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
