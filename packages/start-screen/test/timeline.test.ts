import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG, EASE } from "../src/config";
import { introEnd, introState, outroState, progress } from "../src/core/timeline";

const N = 9;

test("progress is 0 before a span, 1 after it, and eased inside", () => {
  const span = { start: 2, dur: 4, ease: EASE.sheet };
  assert.equal(progress(1.9, span), 0);
  assert.equal(progress(2, span), 0);
  assert.equal(progress(6, span), 1);
  assert.equal(progress(99, span), 1);
  const mid = progress(4, span);
  assert.ok(mid > 0.5 && mid < 1, `sheet is ahead of linear at the midpoint, got ${mid}`);
});

test("intro starts with doors shut, island down, no tiles, no button", () => {
  const s = introState(0, CONFIG.intro, N);
  assert.equal(s.cover, 1);
  assert.equal(s.rise, 0);
  assert.equal(s.grow, 0);
  assert.equal(s.spin, 0);
  assert.equal(s.foam, 0);
  assert.deepEqual(s.tiles, new Array(N).fill(0));
  assert.deepEqual(s.tilePop, new Array(N).fill(0));
  assert.equal(s.button, 0);
});

test("intro ends with everything exactly at rest", () => {
  const s = introState(introEnd(CONFIG.intro, N), CONFIG.intro, N);
  assert.equal(s.cover, 0);
  assert.equal(s.rise, 1);
  assert.equal(s.grow, 1);
  assert.equal(s.spin, 1);
  assert.equal(s.foam, 1);
  assert.deepEqual(s.tiles, new Array(N).fill(1));
  assert.deepEqual(s.tilePop, new Array(N).fill(1));
  assert.equal(s.button, 1);
});

test("tiles flip in one after another, first letter first", () => {
  const { tile, tileStagger } = CONFIG.intro;
  const t = tile.start + tileStagger * 2.5;
  const s = introState(t, CONFIG.intro, N);
  assert.ok(s.tiles[0]! > s.tiles[1]! && s.tiles[1]! > s.tiles[2]!, JSON.stringify(s.tiles));
  assert.ok(s.tiles[2]! > 0);
  assert.equal(s.tiles[3], 0);
  assert.equal(s.tiles[N - 1], 0);
});

test("a tile is full size once its pop time has passed", () => {
  const { tile, tilePopSeconds } = CONFIG.intro;
  const s = introState(tile.start + tilePopSeconds, CONFIG.intro, N);
  assert.equal(s.tilePop[0], 1);
  assert.ok(s.tiles[0]! < 1, "but it is still flipping");
});

test("the same time always gives the same frame", () => {
  const a = introState(1.37, CONFIG.intro, N);
  introState(0.2, CONFIG.intro, N);
  introState(5, CONFIG.intro, N);
  assert.deepEqual(introState(1.37, CONFIG.intro, N), a);
});

test("introEnd covers the last tile and the button", () => {
  const { tile, tileStagger, button } = CONFIG.intro;
  const end = introEnd(CONFIG.intro, N);
  assert.ok(end >= tile.start + tileStagger * (N - 1) + tile.dur);
  assert.ok(end >= button.start + button.dur);
});

test("outro starts open and, by doneAt, the doors are shut and everything has left", () => {
  const a = outroState(0, CONFIG.outro, N);
  assert.equal(a.cover, 0);
  assert.equal(a.dive, 0);
  assert.equal(a.button, 0);
  assert.deepEqual(a.tiles, new Array(N).fill(0));
  const b = outroState(CONFIG.outro.doneAt, CONFIG.outro, N);
  assert.equal(b.cover, 1);
  assert.equal(b.dive, 1);
  assert.equal(b.button, 1);
  assert.deepEqual(b.tiles, new Array(N).fill(1));
});

test("tiles leave last letter first", () => {
  const { tile, tileStagger } = CONFIG.outro;
  const s = outroState(tile.start + tileStagger * 1.5 + 0.1, CONFIG.outro, N);
  assert.ok(s.tiles[N - 1]! > s.tiles[N - 2]!, JSON.stringify(s.tiles));
  assert.ok(s.tiles[N - 2]! > s.tiles[0]!);
});

import { roundelIdleTurn } from "../src/core/timeline";

const R = CONFIG.hud.roundel;
const restAt = introEnd(CONFIG.intro, N);

test("a roundel holds still until the intro has rested for one interval", () => {
  assert.equal(roundelIdleTurn(0, restAt, 0, R), 0);
  assert.equal(roundelIdleTurn(restAt, restAt, 0, R), 0);
  assert.equal(roundelIdleTurn(restAt + R.idleEverySeconds - 0.01, restAt, 0, R), 0);
});

test("then it spins once like a coin, and rests again", () => {
  const start = restAt + R.idleEverySeconds;
  const mid = roundelIdleTurn(start + R.idleSpinSeconds / 2, restAt, 0, R);
  assert.ok(mid > 0.5 && mid < Math.PI * 2.4, `mid ${mid}`);
  assert.equal(roundelIdleTurn(start + R.idleSpinSeconds + 0.01, restAt, 0, R), 0);
  assert.ok(roundelIdleTurn(start + R.idleEverySeconds + R.idleSpinSeconds / 2, restAt, 0, R) > 0.5, "and again later");
});

test("the second roundel spins a little after the first", () => {
  const start = restAt + R.idleEverySeconds;
  const t = start + R.idleStaggerSeconds / 2;
  assert.ok(roundelIdleTurn(t, restAt, 0, R) > 0);
  assert.equal(roundelIdleTurn(t, restAt, 1, R), 0);
});

import { revealCover } from "../src/core/timeline";

const RV = CONFIG.reveal;

test("reveal: the doors stay shut for a beat after BEGIN, then open fully", () => {
  assert.equal(revealCover(0, RV), 1);
  assert.equal(revealCover(RV.holdSeconds, RV), 1);
  assert.equal(revealCover(RV.holdSeconds + RV.openSeconds, RV), 0);
  assert.equal(revealCover(99, RV), 0);
  const mid = revealCover(RV.holdSeconds + RV.openSeconds / 2, RV);
  assert.ok(mid > 0.2 && mid < 0.8, `half way: ${mid}`);
});

test("reveal: the doors only ever open, never bounce back", () => {
  let last = 1;
  for (let t = 0; t <= RV.holdSeconds + RV.openSeconds + 0.1; t += 0.01) {
    const cover = revealCover(t, RV);
    assert.ok(cover <= last + 1e-9 && cover >= 0 && cover <= 1, `t=${t.toFixed(2)} cover=${cover}`);
    last = cover;
  }
});
