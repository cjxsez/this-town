import type { CSSProperties } from "react";

/**
 * A heading set in letter tiles, like IN THIS TOWN on the start screen: each
 * letter on its own chunky paper tile. For short section names (PASSPORT,
 * MEMORIES). Screen readers get the plain text.
 */
export function TileTitle({ text, size = 20, as: Tag = "h1", style }: { text: string; size?: number; as?: "h1" | "h2" | "div"; style?: CSSProperties }) {
  const words = text.trim().split(/\s+/);
  return (
    <Tag className="q-tiles" style={{ fontSize: size, ...style }}>
      <span className="q-sr">{text}</span>
      <span className="q-tiles__art" aria-hidden>
        {words.map((word, w) => (
          <span key={w} className="q-tiles__word">
            {Array.from(word).map((c, i) => (
              <span key={i} className="q-tile">
                {c}
              </span>
            ))}
          </span>
        ))}
      </span>
    </Tag>
  );
}
