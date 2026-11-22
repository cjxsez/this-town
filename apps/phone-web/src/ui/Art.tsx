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
 * The person's rider (public/art/portrait-<color>.webp, `pnpm art`) on a disc tinted with
 * their pair color: the same color the kiosk LEDs, kiosk screen and glasses show for this
 * match. It's how you recognize each other's kiosk. Shows the initial if the art is missing.
 */
export function PairToken({ color, name, size = 56, style }: { color: PairColor; name?: string; size?: number; style?: CSSProperties }) {
  const [art, setArt] = useState(true);
  return (
    <div
      className={`q-animal${art || LIGHT.has(color) ? " q-animal--light" : ""}`}
      style={{
        width: size,
        height: size,
        background: art ? `color-mix(in srgb, ${PAIR_COLOR_HEX[color]} 38%, var(--paper))` : PAIR_COLOR_HEX[color],
        fontSize: Math.max(12, size / 2.4),
        display: "grid",
        placeItems: "center",
        fontFamily: "var(--font-display)",
        ...style,
      }}
      role="img"
      aria-label={name ? `${name}, ${color}` : color}
    >
      {art ? (
        <img
          src={`/art/portrait-${color}.webp`}
          alt=""
          draggable={false}
          onError={() => setArt(false)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 20%" }}
        />
      ) : name ? (
        name.slice(0, 1).toUpperCase()
      ) : null}
    </div>
  );
}
