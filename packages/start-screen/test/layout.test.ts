import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../src/config";
import { computeLayout, hitTest, rowOptions, splitTitle } from "../src/core/layout";

const rows = (l: ReturnType<typeof computeLayout>) => {
  const out: string[] = [];
  for (const t of l.tiles) out[t.row] = (out[t.row] ?? "") + t.char;
  return out;
};

test("splitTitle: QUESTLINE splits into QUEST over LINE", () => {
  assert.deepEqual(splitTitle("QUESTLINE", 5), ["QUEST", "LINE"]);
});

test("splitTitle: a space forces a row break and is not drawn", () => {
  assert.deepEqual(splitTitle("QUEST LINE", 5), ["QUEST", "LINE"]);
  assert.deepEqual(splitTitle("IN THIS TOWN", 5), ["IN", "THIS", "TOWN"]);
});

test("splitTitle: long words are balanced, longer rows first", () => {
  assert.deepEqual(splitTitle("ABCDEF", 5), ["ABC", "DEF"]);
  assert.deepEqual(splitTitle("ABCDEFGHIJKL", 5), ["ABCD", "EFGH", "IJKL"]);
  assert.deepEqual(splitTitle("ABCDEFG", 5), ["ABCD", "EFG"]);
});

test("splitTitle: short and empty titles", () => {
  assert.deepEqual(splitTitle("HI", 5), ["HI"]);
  assert.deepEqual(splitTitle("", 5), []);
  assert.deepEqual(splitTitle("   ", 5), []);
});

test("rowOptions: words may share a row, a long word's pieces never do", () => {
  assert.deepEqual(
    rowOptions("IN THIS TOWN", 5).map((o) => o.map((r) => r.join(" "))),
    [["IN THIS TOWN"], ["IN THIS", "TOWN"], ["IN", "THIS TOWN"], ["IN", "THIS", "TOWN"]],
  );
  assert.deepEqual(rowOptions("QUESTLINE", 5), [[["QUEST"], ["LINE"]]]);
  assert.deepEqual(rowOptions("", 5), [[]]);
});

const SIZES = {
  phone: [402, 874],
  smallPhone: [360, 640],
  phoneLandscape: [844, 390],
  appShellLandscape: [430, 390],
  tablet: [820, 1180],
  desktop: [1440, 900],
} as const;

test("IN THIS TOWN stacks on a phone, runs in one line on a desktop, two lines in landscape", () => {
  assert.deepEqual(rows(computeLayout(...SIZES.phone, "IN THIS TOWN", CONFIG)), ["IN", "THIS", "TOWN"]);
  assert.deepEqual(rows(computeLayout(...SIZES.desktop, "IN THIS TOWN", CONFIG)), ["INTHISTOWN"]);
  assert.deepEqual(rows(computeLayout(...SIZES.appShellLandscape, "IN THIS TOWN", CONFIG)), ["INTHIS", "TOWN"]);
});

test("QUESTLINE keeps its tile size from before: width-bound on a phone, height-bound on a desktop", () => {
  const phone = computeLayout(...SIZES.phone, "QUESTLINE", CONFIG);
  const desktop = computeLayout(...SIZES.desktop, "QUESTLINE", CONFIG);
  assert.deepEqual(rows(phone), ["QUEST", "LINE"]);
  assert.ok(Math.abs(phone.tileW - 402 * 0.158) < 0.05, `${phone.tileW}`);
  assert.ok(Math.abs(desktop.tileW - 900 * CONFIG.hud.title.tileWidthOfH) < 1e-6);
});

for (const title of ["IN THIS TOWN", "QUESTLINE", "GO"]) {
  for (const [name, [w, h]] of Object.entries(SIZES)) {
    for (const insets of [{ top: 0, bottom: 0 }, { top: 47, bottom: 34 }]) {
      const l = computeLayout(w, h, title, CONFIG, insets);
      const tag = `${title} ${name} insets ${insets.top}/${insets.bottom}`;

      test(`${tag}: tiles and button are on screen, clear of the notch and home bar`, () => {
        const margin = 8;
        for (const t of l.tiles) {
          assert.ok(Math.abs(t.cx) + l.tileW / 2 <= w / 2 - margin, `tile ${t.char} x`);
          assert.ok(t.cy + l.tileH / 2 <= h / 2 - insets.top - margin, `tile ${t.char} top`);
          assert.ok(t.cy - l.tileH / 2 >= -h / 2 + margin, `tile ${t.char} bottom`);
        }
        const b = l.button;
        assert.ok(Math.abs(b.cx) + b.w / 2 <= w / 2 - margin);
        assert.ok(b.cy - b.h / 2 >= -h / 2 + insets.bottom + margin, "button above the home bar");
      });

      test(`${tag}: rows centred and top to bottom, button below the title, no overlaps`, () => {
        const rowCount = Math.max(...l.tiles.map((t) => t.row)) + 1;
        for (let r = 0; r < rowCount; r++) {
          const row = l.tiles.filter((t) => t.row === r);
          const left = row[0]!.cx - l.tileW / 2;
          const right = row[row.length - 1]!.cx + l.tileW / 2;
          assert.ok(Math.abs(left + right) < 1e-6, `row ${r} centred`);
          for (let i = 1; i < row.length; i++) assert.ok(row[i]!.cx - row[i - 1]!.cx >= l.tileW, "no overlap");
          if (r > 0) assert.ok(row[0]!.cy < l.tiles.find((t) => t.row === r - 1)!.cy, "rows go down");
        }
        const lowest = Math.min(...l.tiles.map((t) => t.cy - l.tileH / 2));
        assert.ok(l.button.cy + l.button.h / 2 < lowest);
      });
    }
  }
}

test("words sharing a row have a wider gap between them than letters do", () => {
  const l = computeLayout(...SIZES.desktop, "IN THIS TOWN", CONFIG);
  const step = (i: number) => l.tiles[i + 1]!.cx - l.tiles[i]!.cx;
  assert.ok(step(1) > step(0) + l.tileW * 0.2, "N to T is a word gap");
  assert.ok(Math.abs(step(2) - step(0)) < 1e-9, "T to H is a letter gap");
});

test("a short title gets bigger tiles, but the button stays the same size", () => {
  const short = computeLayout(...SIZES.phone, "GO NOW", CONFIG);
  const long = computeLayout(...SIZES.phone, "QUESTLINE", CONFIG);
  assert.ok(short.tileW > long.tileW);
  assert.deepEqual(short.button, long.button);
});

test("hit testing finds tiles and the button, and nothing in the gaps", () => {
  const l = computeLayout(...SIZES.phone, "QUESTLINE", CONFIG);
  const t3 = l.tiles[3]!;
  assert.deepEqual(hitTest(l, t3.cx, t3.cy), { kind: "tile", index: 3 });
  assert.deepEqual(hitTest(l, t3.cx + l.tileW * 0.45, t3.cy - l.tileH * 0.45), { kind: "tile", index: 3 });
  assert.deepEqual(hitTest(l, l.button.cx, l.button.cy), { kind: "button" });
  assert.equal(hitTest(l, 0, 0), null);
  const a = l.tiles[0]!;
  const b = l.tiles[1]!;
  assert.equal(hitTest(l, (a.cx + b.cx) / 2, a.cy), null);
});

import { roundelMask } from "../src/core/layout";

test("roundelMask: only the T of TOWN, not the T of THIS", () => {
  const R = { letters: ["T"], words: ["TOWN"] };
  assert.deepEqual(roundelMask("IN THIS TOWN", R), [false, false, false, false, false, false, true, false, false, false]);
});

test("roundelMask: with no word list, every matching letter is a roundel; other titles get none", () => {
  assert.deepEqual(roundelMask("TO IT", { letters: ["T"], words: [] }), [true, false, false, true]);
  assert.deepEqual(roundelMask("QUESTLINE", { letters: ["T"], words: ["TOWN"] }), new Array(9).fill(false));
});
