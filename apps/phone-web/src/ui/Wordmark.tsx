import type { CSSProperties } from "react";

export const GAME_NAME = "In This Town";
const WORDS = ["IN", "THIS", "TOWN"];

/**
 * The game's name in letter tiles, the 2D twin of the start screen's title: one
 * chunky paper tile per letter, and the T of TOWN as a green roundel, because
 * the T is what Boston calls the MBTA (our own mark, not the MBTA logo; THIS
 * keeps a plain T). Screen readers hear "In This Town".
 */
export function Wordmark({
  size = 26,
  style,
  enterAt,
}: {
  size?: number;
  style?: CSSProperties;
  /** Drop the tiles in one by one, the first this many ms after mounting. */
  enterAt?: number;
}) {
  let n = 0;
  const enter = (): { className: string; style?: CSSProperties } =>
    enterAt === undefined ? { className: "" } : { className: " q-enter-tile", style: { "--d": enterAt + 55 * n++ } as CSSProperties };
  return (
    <span className="q-tiles q-tiles--center" style={{ display: "block", fontSize: size, ...style }}>
      <span className="q-sr">{GAME_NAME}</span>
      <span className="q-tiles__art" aria-hidden>
        {WORDS.map((word) => (
          <span key={word} className="q-tiles__word">
            {Array.from(word).map((c, i) => {
              const e = enter();
              return (
                <span key={i} className={(c === "T" && word === "TOWN" ? "q-tile q-tile--roundel" : "q-tile") + e.className} style={e.style}>
                  {c}
                </span>
              );
            })}
          </span>
        ))}
      </span>
    </span>
  );
}
