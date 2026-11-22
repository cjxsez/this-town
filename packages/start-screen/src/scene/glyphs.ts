/**
 * Letters for the tiles and the button, drawn once with the app's display face
 * (Bungee) into a canvas and used as a texture. Two channels:
 * - red:   ink-coloured letters (square tiles, the button label)
 * - green: paper-coloured art (the roundel's ring and its T)
 */
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter } from "three";
import "@fontsource/bungee/latin-400.css";
import type { Config } from "../config";
import type { AtlasRects } from "./hud";

const FONT = '"Bungee", "Arial Black", sans-serif';
const COLUMNS = 4;

export interface GlyphAtlas extends AtlasRects {
  texture: CanvasTexture;
  dispose(): void;
}

/** Wait for Bungee, but never for long: a late font should not hold up the screen. */
export async function loadFonts(timeoutMs = 2500): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.race([
    document.fonts.load(`400 64px ${FONT}`).catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

const DARK = "#f00";
const LIGHT = "#0f0";

export function buildGlyphAtlas(
  chars: string[],
  roundelFlags: readonly boolean[],
  label: string,
  config: Config,
): GlyphAtlas {
  const { title, button, roundel, glyphCellPx: cellW } = config.hud;
  const cellH = Math.round(cellW * title.tileAspect);
  const unique = [...new Set(chars.filter((_, i) => !roundelFlags[i]))];
  const roundels = [...new Set(chars.filter((_, i) => roundelFlags[i]))];
  const rows = Math.max(1, Math.ceil(unique.length / COLUMNS));
  const roundelRows = Math.ceil(roundels.length / COLUMNS);
  const width = cellW * COLUMNS;
  const labelH = Math.round(width / button.aspect);
  const height = rows * cellH + roundelRows * cellW + labelH;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = DARK;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const REF = 100;
  const measure = (text: string) => {
    ctx.font = `400 ${REF}px ${FONT}`;
    const m = ctx.measureText(text);
    return { left: m.actualBoundingBoxLeft, right: m.actualBoundingBoxRight, cap: m.actualBoundingBoxAscent };
  };
  const capHeight = measure("H").cap;

  /** Draw `text` centred in a box: side to side by its own ink, top to bottom by the cap height. */
  const draw = (text: string, x: number, y: number, w: number, h: number, px: number) => {
    const m = measure(text);
    const k = px / REF;
    ctx.font = `400 ${px}px ${FONT}`;
    ctx.fillText(text, x + w / 2 - ((m.right - m.left) * k) / 2, y + h / 2 + (capHeight * k) / 2);
  };

  // One size for every letter: the widest one fills `letterFill` of the tile.
  const widest = Math.max(1, ...unique.map((c) => measure(c).left + measure(c).right));
  const letterPx = Math.min((title.letterFill * cellW * REF) / widest, (0.6 * cellH * REF) / capHeight);

  const rects = new Map<string, { u0: number; v0: number; u1: number; v1: number }>();
  const remember = (key: string, x: number, y: number, w: number, h: number) =>
    rects.set(key, { u0: x / width, v0: 1 - (y + h) / height, u1: (x + w) / width, v1: 1 - y / height });

  unique.forEach((char, i) => {
    const x = (i % COLUMNS) * cellW;
    const y = Math.floor(i / COLUMNS) * cellH;
    draw(char, x, y, cellW, cellH, letterPx);
    remember(char, x, y, cellW, cellH);
  });

  // Roundels: a square cell each, mapped onto the whole disc. Ring and letter in the light channel.
  roundels.forEach((char, i) => {
    const x = (i % COLUMNS) * cellW;
    const y = rows * cellH + Math.floor(i / COLUMNS) * cellW;
    ctx.save();
    ctx.strokeStyle = LIGHT;
    ctx.fillStyle = LIGHT;
    ctx.lineWidth = roundel.ringWidth * cellW;
    ctx.beginPath();
    ctx.arc(x + cellW / 2, y + cellW / 2, roundel.ringRadius * cellW, 0, Math.PI * 2);
    ctx.stroke();
    draw(char, x, y, cellW, cellW, (roundel.letterHeight * cellW * REF) / capHeight);
    ctx.restore();
    remember(`roundel:${char}`, x, y, cellW, cellW);
  });

  const labelY = rows * cellH + roundelRows * cellW;
  const labelInk = measure(label);
  const labelPx = Math.min(
    (button.letterFill * width * REF) / Math.max(1, labelInk.left + labelInk.right),
    (0.46 * labelH * REF) / capHeight,
  );
  draw(label, 0, labelY, width, labelH, labelPx);
  remember("label", 0, labelY, width, labelH);

  const texture = new CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 4;

  const blank = { u0: 0, v0: 0, u1: 0, v1: 0 };
  return {
    texture,
    rect: (key) => rects.get(key) ?? blank,
    dispose: () => texture.dispose(),
  };
}
