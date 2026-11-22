import { test } from "node:test";
import assert from "node:assert/strict";
import { StartClock, type ClockOptions } from "../src/core/clock";

const cues = {
  intro: [
    { name: "doors", at: 0 },
    { name: "letters", at: 1 },
  ],
  outro: [
    { name: "click", at: 0 },
    { name: "doors-close", at: 0.7 },
  ],
} as const;
const base: ClockOptions = { freezeAt: null, freezeOutroAt: null, reducedMotion: false, restAt: 2.5, inputAt: 1.9, doneAt: 1.4 };
const make = (over: Partial<ClockOptions> = {}) => {
  const fired: string[] = [];
  return { clock: new StartClock({ ...base, ...over }, cues, (name) => fired.push(name)), fired };
};

test("the intro clock runs from 0 and fires its cues as it passes them", () => {
  const { clock, fired } = make();
  assert.equal(clock.t, 0);
  clock.tick(0);
  assert.deepEqual(fired, ["doors"]);
  clock.tick(0.6);
  clock.tick(0.6);
  assert.ok(Math.abs(clock.t - 1.2) < 1e-9);
  assert.deepEqual(fired, ["doors", "letters"]);
  assert.equal(clock.outT, null);
});

test("BEGIN does nothing until input is on, then starts the second clock once", () => {
  const { clock, fired } = make();
  clock.tick(1);
  assert.equal(clock.inputOn, false);
  assert.equal(clock.begin(), false);
  clock.tick(1);
  assert.equal(clock.inputOn, true);
  assert.equal(clock.begin(), true);
  assert.equal(clock.begin(), false, "a second press is ignored");
  assert.equal(clock.inputOn, false, "no more input once it has begun");
  assert.equal(clock.outT, 0);
  clock.tick(0.8);
  assert.deepEqual(fired, ["doors", "letters", "click", "doors-close"]);
  assert.equal(clock.finished, false);
  clock.tick(0.6);
  assert.equal(clock.finished, true);
});

test("the world keeps turning after BEGIN", () => {
  const { clock } = make();
  clock.tick(2);
  clock.begin();
  clock.tick(0.5);
  assert.ok(Math.abs(clock.t - 2.5) < 1e-9);
});

test("?t= freezes the intro clock: no time passes, no cues, no BEGIN", () => {
  const { clock, fired } = make({ freezeAt: 2.2 });
  clock.tick(5);
  assert.equal(clock.t, 2.2);
  assert.deepEqual(fired, []);
  assert.equal(clock.inputOn, true, "a frozen frame can still be poked");
  assert.equal(clock.begin(), false);
  assert.equal(clock.outT, null);
});

test("?out= freezes the second clock on the resting scene", () => {
  const { clock, fired } = make({ freezeOutroAt: 0.6 });
  clock.tick(3);
  assert.equal(clock.t, base.restAt);
  assert.equal(clock.outT, 0.6);
  assert.equal(clock.inputOn, false);
  assert.equal(clock.finished, false);
  assert.deepEqual(fired, []);
});

test("?t= and ?out= together hold both clocks", () => {
  const { clock } = make({ freezeAt: 4, freezeOutroAt: 1 });
  clock.tick(1);
  assert.equal(clock.t, 4);
  assert.equal(clock.outT, 1);
});

test("reduced motion starts on the resting scene, silently, and holds the world still", () => {
  const { clock, fired } = make({ reducedMotion: true });
  assert.equal(clock.t, base.restAt);
  clock.tick(1);
  assert.equal(clock.t, base.restAt);
  assert.deepEqual(fired, [], "the intro was skipped, so its sounds are too");
  assert.equal(clock.inputOn, true);
  assert.equal(clock.begin(), true);
  clock.tick(1.5);
  assert.deepEqual(fired, ["click", "doors-close"]);
  assert.equal(clock.finished, true);
});
