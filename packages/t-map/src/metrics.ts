// Advance widths of Helvetica Neue for printable ASCII, in 1/1000 em (no kerning).
// Used to place marks at the far end of a label and to test that labels do not collide.
// Other fonts in the stack differ by a few percent, which these uses tolerate.
const REGULAR = [278,259,426,556,556,1000,630,278,259,259,352,600,278,389,278,333,556,556,556,556,556,556,556,556,556,556,278,278,600,600,600,556,800,648,685,722,704,611,574,759,722,259,519,667,556,871,722,760,648,760,685,648,574,722,611,926,611,648,611,259,333,259,600,500,222,537,593,537,593,537,296,574,556,222,222,519,222,853,556,574,593,593,333,500,315,556,500,758,518,500,480,333,222,333,600];
const BOLD = [278,278,463,556,556,1000,685,278,296,296,407,600,278,407,278,371,556,556,556,556,556,556,556,556,556,556,278,278,600,600,600,556,800,685,704,741,741,648,593,759,741,295,556,722,593,907,741,778,667,778,722,649,611,741,630,944,667,667,648,333,371,333,600,500,259,574,611,574,611,574,333,611,593,258,278,574,258,906,593,611,611,611,389,537,352,593,520,814,537,519,519,333,223,333,600];

/** Width of one line of text at a font size, to within a few percent. */
export function textWidth(text: string, size: number, bold = false): number {
  const table = bold ? BOLD : REGULAR;
  let w = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    w += table[code - 32] ?? 556;
  }
  return (w * size) / 1000;
}
