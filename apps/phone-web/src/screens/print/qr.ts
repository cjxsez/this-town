/**
 * A compact QR code encoder for the station poster: byte mode, error
 * correction level M, versions 1–4 (up to 62 bytes, plenty for
 * "https://questline.page/<station>"). No dependencies.
 *
 * Follows ISO/IEC 18004 and the structure of Project Nayuki's reference
 * implementation: encode bits → Reed-Solomon ECC → interleave → place in the
 * zigzag → try all 8 masks and keep the lowest penalty.
 */

// Level M tables, indexed by version (index 0 unused).
const ECC_PER_BLOCK = [0, 10, 16, 26, 18];
const NUM_BLOCKS = [0, 1, 1, 1, 2];
const FORMAT_BITS_M = 0; // L=1, M=0, Q=3, H=2
const MAX_VERSION = 4;

/** Rows of modules, true = dark. matrix[y][x]. */
export type QrMatrix = boolean[][];

// ---- GF(256) Reed-Solomon, primitive polynomial x^8+x^4+x^3+x^2+1 ----

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => (result[i] ^= gfMul(coef, factor)));
  }
  return result;
}

// ---- sizes ----

function rawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}
const dataCodewords = (ver: number) =>
  Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];

// ---- encode ----

/** Encode text (UTF-8) as a QR matrix. Throws if it doesn't fit version 4-M. `forceMask` is for tests. */
export function encodeQr(text: string, forceMask?: number): QrMatrix {
  const bytes = Array.from(new TextEncoder().encode(text));

  let ver = 1;
  for (; ver <= MAX_VERSION; ver++) {
    if (4 + 8 + bytes.length * 8 <= dataCodewords(ver) * 8) break;
  }
  if (ver > MAX_VERSION) throw new Error(`QR: "${text}" is too long for version ${MAX_VERSION}-M`);

  // Bit stream: mode 0100 (byte), 8-bit count (versions 1–9), data.
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  bytes.forEach((b) => push(b, 8));
  const capacity = dataCodewords(ver) * 8;
  push(0, Math.min(4, capacity - bits.length)); // terminator
  push(0, (8 - (bits.length % 8)) % 8); // byte align
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));

  const codewords = addEccAndInterleave(data, ver);
  return drawMatrix(codewords, ver, forceMask);
}

function addEccAndInterleave(data: number[], ver: number): number[] {
  const numBlocks = NUM_BLOCKS[ver];
  const eccLen = ECC_PER_BLOCK[ver];
  const rawCodewords = Math.floor(rawDataModules(ver) / 8);
  const numShort = numBlocks - (rawCodewords % numBlocks);
  const shortLen = Math.floor(rawCodewords / numBlocks);
  const divisor = rsDivisor(eccLen);

  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const len = shortLen - eccLen + (i < numShort ? 0 : 1);
    const dat = data.slice(k, k + len);
    k += len;
    const ecc = rsRemainder(dat, divisor);
    if (i < numShort) dat.push(0); // placeholder so short blocks line up
    blocks.push(dat.concat(ecc));
  }

  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      // Skip the padding cell in short blocks.
      if (i !== shortLen - eccLen || j >= numShort) result.push(block[i]);
    });
  }
  return result;
}

// ---- layout ----

function drawMatrix(codewords: number[], ver: number, forceMask?: number): QrMatrix {
  const size = ver * 4 + 17;
  const m: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fn: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => {
    m[y][x] = dark;
    fn[y][x] = true;
  };

  // Timing patterns.
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  // Finder patterns + separators.
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  // Alignment pattern (versions 2–6 have exactly one, at the bottom right).
  if (ver >= 2) {
    const c = size - 7;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) set(c + dx, c + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  // Reserve format areas (real bits are written per mask below).
  drawFormat(set, size, 0);

  // Data, in the two-column zigzag from the bottom right.
  let i = 0;
  const total = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!fn[y][x] && i < total) {
          m[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
    }
  }

  // Pick the mask with the lowest penalty.
  let best = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(m, fn, mask);
    drawFormat(set, size, mask);
    const score = penalty(m);
    if (score < bestScore) {
      best = mask;
      bestScore = score;
    }
    applyMask(m, fn, mask); // XOR again to undo
  }
  if (forceMask !== undefined) best = forceMask;
  applyMask(m, fn, best);
  drawFormat(set, size, best);
  return m;
}

function drawFormat(set: (x: number, y: number, dark: boolean) => void, size: number, mask: number) {
  const data = (FORMAT_BITS_M << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((bits >>> i) & 1) === 1;

  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6));
  set(8, 8, bit(7));
  set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));

  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true); // the always-dark module
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(m: boolean[][], fn: boolean[][], mask: number) {
  const f = MASKS[mask];
  for (let y = 0; y < m.length; y++)
    for (let x = 0; x < m.length; x++) if (!fn[y][x] && f(x, y)) m[y][x] = !m[y][x];
}

// ---- mask penalty (rules N1–N4) ----

function penalty(m: boolean[][]): number {
  const size = m.length;
  let result = 0;

  const addHistory = (run: number, h: number[]) => {
    if (h[0] === 0) run += size; // light border before the first run
    h.pop();
    h.unshift(run);
  };
  const countFinderLike = (h: number[]) => {
    const n = h[1];
    const core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n;
    return (core && h[0] >= n * 4 && h[6] >= n ? 1 : 0) + (core && h[6] >= n * 4 && h[0] >= n ? 1 : 0);
  };
  const terminate = (color: boolean, run: number, h: number[]) => {
    if (color) {
      addHistory(run, h);
      run = 0;
    }
    addHistory(run + size, h);
    return countFinderLike(h);
  };

  for (const axis of [0, 1]) {
    for (let a = 0; a < size; a++) {
      let color = false;
      let run = 0;
      const h = [0, 0, 0, 0, 0, 0, 0];
      for (let b = 0; b < size; b++) {
        const cell = axis === 0 ? m[a][b] : m[b][a];
        if (cell === color) {
          run++;
          if (run === 5) result += 3;
          else if (run > 5) result++;
        } else {
          addHistory(run, h);
          if (!color) result += countFinderLike(h) * 40;
          color = cell;
          run = 1;
        }
      }
      result += terminate(color, run, h) * 40;
    }
  }

  for (let y = 0; y < size - 1; y++)
    for (let x = 0; x < size - 1; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) result += 3;
    }

  let dark = 0;
  for (const row of m) for (const c of row) if (c) dark++;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  result += k * 10;
  return result;
}

/** One SVG path ("M x y h1 v1 h-1 z" per dark module), for a crisp inline SVG. */
export function qrPath(m: QrMatrix, offset = 0): string {
  let d = "";
  m.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) d += `M${x + offset} ${y + offset}h1v1h-1z`;
    }),
  );
  return d;
}
