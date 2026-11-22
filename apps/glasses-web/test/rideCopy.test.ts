import test from "node:test";
import assert from "node:assert/strict";
import { idleLooking, stampWithLine } from "../src/lib/rideCopy";

test("idle looking line keeps match wording when missions are on", () => {
  assert.equal(idleLooking(false), "Looking for your match…");
  assert.doesNotMatch(idleLooking(true), /mission/i);
  assert.match(idleLooking(true), /play/i);
});

test("stamp body mentions the three games only in games-only", () => {
  assert.equal(stampWithLine("Green-D", "Maya", false), "Green-D Line with Maya");
  assert.equal(stampWithLine("Green-D", "Maya", true), "Played the three games with Maya");
  assert.doesNotMatch(stampWithLine("Green-D", "Maya", true), /mission/i);
});
