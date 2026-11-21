import type { CSSProperties } from "react";

/**
 * PLACEHOLDER for the badge's ArUco 4×4 tag. It draws a 6×6 grid (black
 * border + a 4×4 interior) that is deterministic per badge number, so every
 * printed badge looks distinct, but it is NOT a marker from the real ArUco
 * DICT_4X4_50 dictionary and a detector won't read it.
 * TODO(hardware): swap tagBits() for the real dictionary entries 1–48.
 */
export function tagBits(n: number): boolean[] {
  // A small integer hash (xorshift-multiply) so neighbouring numbers differ a lot.
  let h = (n * 0x9e3779b1) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  const cells: boolean[] = [];
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 6; x++) {
      const border = x === 0 || y === 0 || x === 5 || y === 5;
      const bit = (h >>> ((y - 1) * 4 + (x - 1))) & 1;
      cells.push(border || bit === 1); // true = dark
    }
  return cells;
}

/** The tag as a grid of squares, sized by `cell` (any CSS length). */
export function TagGrid({ n, cell, pad, style }: { n: number; cell: string; pad?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        flex: "none",
        display: "grid",
        gridTemplateColumns: `repeat(6, ${cell})`,
        gridAutoRows: cell,
        padding: pad ?? cell,
        background: "var(--paper)",
        border: "var(--ol) solid var(--ink)",
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
        ...style,
      }}
    >
      {tagBits(n).map((dark, i) => (
        <span key={i} style={{ background: dark ? "var(--ink)" : "var(--paper)" }} />
      ))}
    </div>
  );
}
