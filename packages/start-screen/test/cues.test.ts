import { test } from "node:test";
import assert from "node:assert/strict";
import { CueTrack } from "../src/core/cues";

const cues = [
  { name: "a", at: 0 },
  { name: "b", at: 0.5 },
  { name: "c", at: 2 },
] as const;

test("each cue fires once, in order, when the clock reaches it", () => {
  const fired: string[] = [];
  const track = new CueTrack(cues, (n) => fired.push(n));
  track.advance(0);
  assert.deepEqual(fired, ["a"]);
  track.advance(0.49);
  assert.deepEqual(fired, ["a"]);
  track.advance(0.5);
  track.advance(0.6);
  assert.deepEqual(fired, ["a", "b"]);
  track.advance(10);
  track.advance(11);
  assert.deepEqual(fired, ["a", "b", "c"]);
});

test("a big jump fires everything it passed, in time order", () => {
  const fired: string[] = [];
  new CueTrack([cues[2], cues[0], cues[1]], (n) => fired.push(n)).advance(3);
  assert.deepEqual(fired, ["a", "b", "c"]);
});

test("going back in time does not fire a cue twice", () => {
  const fired: string[] = [];
  const track = new CueTrack(cues, (n) => fired.push(n));
  track.advance(1);
  track.advance(0);
  track.advance(1);
  assert.deepEqual(fired, ["a", "b"]);
});
