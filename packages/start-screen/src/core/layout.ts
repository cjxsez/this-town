/**
 * Where the title tiles and the button sit on screen.
 *
 * Everything is in CSS pixels measured from the middle of the viewport, x to the
 * right and y UP (the same way the camera sees it). The 3D title is placed from
 * these numbers and pointer hit-testing uses them too, so what you see and what
 * you can touch always agree.
 *
 * The title picks its own shape: the words go on one row, or stack, whichever
 * gives the biggest tiles on this screen. IN THIS TOWN stacks three high on a
 * phone and runs in one line on a desktop.
 */
import type { Config } from "../config";

export interface TileSlot {
  char: string;
  row: number;
  col: number;
  cx: number;
  cy: number;
}

export interface HudLayout {
  viewW: number;
  viewH: number;
  tileW: number;
  tileH: number;
  tiles: TileSlot[];
  button: { cx: number; cy: number; w: number; h: number };
}

/** Space taken by a notch or status bar (top) and a home bar (bottom), CSS pixels. */
export interface Insets {
  top: number;
  bottom: number;
}

export type Hit = { kind: "tile"; index: number } | { kind: "button" } | null;

/** A word too long for one row, broken into balanced pieces (QUESTLINE -> QUEST, LINE). */
function breakWord(word: string, maxPerRow: number): string[] {
  const chars = Array.from(word);
  const rowCount = Math.ceil(chars.length / maxPerRow);
  const base = Math.floor(chars.length / rowCount);
  let extra = chars.length % rowCount;
  const pieces: string[] = [];
  let at = 0;
  for (let r = 0; r < rowCount; r++) {
    const length = base + (extra-- > 0 ? 1 : 0);
    pieces.push(chars.slice(at, at + length).join(""));
    at += length;
  }
  return pieces;
}

/** One row per word (long words broken over rows). The tallest shape the title can take. */
export function splitTitle(title: string, maxPerRow: number): string[] {
  return title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => breakWord(word, maxPerRow));
}

/** A shape for the title: rows, each a list of words. */
export type RowOption = string[][];

/**
 * Every way to put the title's words into rows, keeping their order. Neighbouring
 * words may share a row; the pieces of a broken long word never do. Fewest rows
 * first, then top-heavy shapes first.
 */
export function rowOptions(title: string, maxPerRow: number): RowOption[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [[]];
  // Pieces in reading order, and whether a row break before each one is forced.
  const pieces: { text: string; forced: boolean }[] = [];
  for (const word of words.slice(0, 8)) {
    breakWord(word, maxPerRow).forEach((text, i) => pieces.push({ text, forced: i > 0 }));
  }
  const free = pieces.map((p, i) => (i > 0 && !p.forced ? i : -1)).filter((i) => i > 0);
  const options: RowOption[] = [];
  for (let mask = 0; mask < 1 << free.length; mask++) {
    const breaks = new Set(free.filter((_, k) => mask & (1 << k)));
    const rows: RowOption = [];
    pieces.forEach((p, i) => {
      if (i === 0 || p.forced || breaks.has(i)) rows.push([p.text]);
      else rows[rows.length - 1]!.push(p.text);
    });
    options.push(rows);
  }
  const shape = (o: RowOption) => o.map((r) => r.length);
  return options.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    const sa = shape(a);
    const sb = shape(b);
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sb[i]! - sa[i]!;
    return 0;
  });
}

/** A row's width in tile widths. */
function rowUnits(words: string[], gap: number, wordGap: number): number {
  const letters = words.reduce((n, w) => n + Array.from(w).length, 0);
  return letters + (letters - words.length) * gap + (words.length - 1) * wordGap;
}

export function computeLayout(
  viewW: number,
  viewH: number,
  title: string,
  config: Pick<Config, "hud" | "maxLettersPerRow">,
  insets: Insets = { top: 0, bottom: 0 },
): HudLayout {
  const { title: T, button: B } = config.hud;
  const blockUnits = (rows: number) => rows * T.tileAspect + Math.max(0, rows - 1) * T.rowGap;

  // Pick the shape that gives the biggest tiles. A shape with more rows has to win
  // by a clear margin, so the choice does not flicker between two near-equal shapes.
  let rows: RowOption = [];
  let tileW = 0;
  for (const option of rowOptions(title, config.maxLettersPerRow)) {
    const widest = Math.max(1, ...option.map((r) => rowUnits(r, T.gap, T.wordGap)));
    const size = Math.min(
      (viewW * T.rowWidthOfW) / widest,
      (viewH * T.blockHeightOfH) / blockUnits(Math.max(1, option.length)),
      viewH * T.tileWidthOfH,
    );
    if (size > tileW * 1.02) {
      tileW = size;
      rows = option;
    }
  }
  const tileH = tileW * T.tileAspect;
  const blockH = blockUnits(rows.length) * tileW;
  const stepY = tileH + tileW * T.rowGap;

  // Centred where the config says, but pushed down below the notch if it would reach it.
  const topLimit = viewH / 2 - insets.top - viewH * T.topMarginOfH;
  const centerY = Math.min(viewH * T.centerAboveMiddle, topLimit - blockH / 2);
  const topRowY = centerY + blockH / 2 - tileH / 2;

  const tiles: TileSlot[] = [];
  rows.forEach((words, row) => {
    let x = -(rowUnits(words, T.gap, T.wordGap) * tileW) / 2 + tileW / 2;
    let col = 0;
    words.forEach((word, w) => {
      if (w > 0) x += tileW * (T.wordGap - T.gap);
      for (const char of Array.from(word)) {
        tiles.push({ char, row, col: col++, cx: x, cy: topRowY - row * stepY });
        x += tileW * (1 + T.gap);
      }
    });
  });

  // The button's size does not depend on the title, and it stays above the home bar.
  const h = Math.min(viewW * B.heightOfW, viewH * B.heightOfH);
  const bottomLimit = -viewH / 2 + insets.bottom + viewH * B.bottomMarginOfH;
  const cy = Math.max(-viewH * B.centerBelowMiddle, bottomLimit + h / 2);

  return { viewW, viewH, tileW, tileH, tiles, button: { cx: 0, cy, w: h * B.aspect, h } };
}

/** What is under a point (px from the middle of the viewport, y up)? */
export function hitTest(layout: HudLayout, x: number, y: number): Hit {
  const { button, tiles, tileW, tileH } = layout;
  if (Math.abs(x - button.cx) <= button.w / 2 && Math.abs(y - button.cy) <= button.h / 2) return { kind: "button" };
  for (let index = 0; index < tiles.length; index++) {
    const t = tiles[index]!;
    if (Math.abs(x - t.cx) <= tileW / 2 && Math.abs(y - t.cy) <= tileH / 2) return { kind: "tile", index };
  }
  return null;
}
