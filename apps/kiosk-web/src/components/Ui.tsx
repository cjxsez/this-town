/**
 * Ui.tsx (kiosk-web): the phone app's building blocks, sized for the kiosk.
 * Mirrors apps/phone-web/src/ui (Wordmark, PairToken, Screen blobs, HandDrawnFx).
 */
import type { CSSProperties, ReactNode } from "react";
import { PAIR_COLOR_HEX, type PairColor } from "@questline/protocol";

export const GAME_NAME = "In This Town";
const WORDS = ["IN", "THIS", "TOWN"];

/** IN THIS TOWN in letter tiles, the T of TOWN as a green roundel (same as the phone). */
export function Wordmark({ size = 22, style }: { size?: number; style?: CSSProperties }) {
  return (
    <span className="k-tiles" style={{ display: "block", fontSize: size, ...style }}>
      <span className="k-tiles__art" aria-label={GAME_NAME}>
        {WORDS.map((word) => (
          <span key={word} className="k-tiles__word">
            {Array.from(word).map((c, i) => (
              <span key={i} className={c === "T" && word === "TOWN" ? "k-tile k-tile--roundel" : "k-tile"}>
                {c}
              </span>
            ))}
          </span>
        ))}
      </span>
    </span>
  );
}

const LIGHT = new Set<PairColor>(["yellow", "green", "orange"]);

/** Ink text reads better than paper on these pair colors. */
export function isLightPair(color: PairColor): boolean {
  return LIGHT.has(color);
}

/** The pair color with a first initial: the same color the LEDs and the glasses show. */
export function PairToken({ color, name, size = 64, style }: { color: PairColor; name?: string; size?: number; style?: CSSProperties }) {
  return (
    <div
      className={`k-token${isLightPair(color) ? " k-token--light" : ""}`}
      style={{ width: size, height: size, background: PAIR_COLOR_HEX[color], fontSize: Math.max(14, size / 2.3), ...style }}
      aria-hidden
    >
      {name ? name.slice(0, 1).toUpperCase() : null}
    </div>
  );
}

/** Foam clouds behind a screen, like the phone's Screen blobs. */
const BLOBS = {
  a: [
    { left: -90, top: 40, width: 420, height: 230, borderRadius: "46% 54% 60% 40%/55% 45% 55% 45%" },
    { left: 470, top: 210, width: 420, height: 220, borderRadius: "58% 42% 45% 55%/45% 60% 40% 55%" },
  ],
  b: [
    { left: 420, top: -40, width: 460, height: 240, borderRadius: "46% 54% 60% 40%/55% 45% 55% 45%" },
    { left: -110, top: 230, width: 420, height: 230, borderRadius: "58% 42% 45% 55%/45% 60% 40% 55%" },
  ],
} satisfies Record<string, CSSProperties[]>;

export function Screen({
  children,
  blobs = "a",
  className,
  style,
  label,
}: {
  children: ReactNode;
  blobs?: keyof typeof BLOBS | false;
  className?: string;
  style?: CSSProperties;
  label: string;
}) {
  return (
    <main className={`k-screen ${className ?? ""}`} style={style} aria-label={label}>
      {blobs && BLOBS[blobs].map((s, i) => <div key={i} className="k-blob" style={s} />)}
      {children}
    </main>
  );
}

/** The NFC phone mark, in a paper disc with two pulse rings. */
export function NfcMark({ size = 120 }: { size?: number }) {
  return (
    <div className="k-nfc" style={{ width: size, height: size }} aria-hidden>
      <span className="k-nfc__ring" />
      <span className="k-nfc__ring" />
      <span className="k-nfc__face">
        <svg width={size * 0.6} height={size * 0.6} viewBox="-6 0 76 64" fill="none" stroke="var(--ink)" strokeWidth={5} strokeLinecap="round">
          <rect x="18" y="8" width="28" height="48" rx="5" fill="var(--sky)" />
          <path d="M8 24c-3 5-3 11 0 16" />
          <path d="M2 18c-5 9-5 19 0 28" />
          <path d="M56 24c3 5 3 11 0 16" />
          <path d="M62 18c5 9 5 19 0 28" />
        </svg>
      </span>
    </div>
  );
}

/** Static versions of the phone's hand-drawn filters (wobbly outlines, ragged foam). */
export function HandDrawnFilters() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <filter id="ql-wob" x="-6%" y="-6%" width="112%" height="112%">
        <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves={2} seed={7} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={3.4} xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id="ql-rag" x="-18%" y="-18%" width="136%" height="136%">
        <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves={3} seed={3} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={40} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

/** A file from public/art, under the /kiosk/ base. */
export function art(name: string): string {
  return `${import.meta.env.BASE_URL}art/${name}`;
}
