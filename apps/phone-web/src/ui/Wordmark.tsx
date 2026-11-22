import type { CSSProperties } from "react";

export const GAME_NAME = "In This Town";
const WORDS = ["IN", "THIS", "TOWN"];

/**
 * The game's name in Bungee Shade, with the T of TOWN as a green roundel: the T is
 * what Boston calls the MBTA (THIS keeps a plain T, as on the start screen). The 2D twin of the start screen's tiles (our own mark,
 * not the MBTA logo). Screen readers hear "In This Town".
 */
export function Wordmark({ size = 44, style }: { size?: number; style?: CSSProperties }) {
  return (
    <span className="q-wordmark" style={{ fontSize: size, ...style }}>
      <span className="q-sr">{GAME_NAME}</span>
      <span className="q-wordmark__art" aria-hidden>
        {WORDS.map((word) => (
          <span key={word} className="q-wordmark__word">
            {Array.from(word).map((c, i) =>
              c === "T" && word === "TOWN" ? (
                <span key={i} className="q-roundel">
                  <span>T</span>
                </span>
              ) : (
                c
              ),
            )}
          </span>
        ))}
      </span>
    </span>
  );
}
