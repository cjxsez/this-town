import test from "node:test";
import assert from "node:assert/strict";
import {
  destinationHint,
  rideModeEndsRule,
  rideModeMissionRule,
  ridingStayOnHint,
} from "../src/lib/rideModeCopy";

test("destinationHint: mission mode mentions missions before a stop", () => {
  assert.match(destinationHint(false), /missions always end before a stop/);
});

test("destinationHint: games-only skips mission wording", () => {
  assert.doesNotMatch(destinationHint(true), /mission/i);
  assert.match(destinationHint(true), /phones or glasses/i);
});

test("rideModeMissionRule and ends rule switch on gamesOnly", () => {
  assert.match(rideModeMissionRule(false), /short mission/);
  assert.match(rideModeMissionRule(true), /games/);
  assert.match(rideModeEndsRule("Hynes", false), /turns off by itself at Hynes/);
  assert.match(rideModeEndsRule("Hynes", true), /stays on until you turn it off/);
});

test("ridingStayOnHint keeps the other-riders prefix", () => {
  assert.match(ridingStayOnHint(3, "Hynes", false), /2 other riders/);
  assert.match(ridingStayOnHint(3, "Hynes", false), /turns off at Hynes/);
  assert.match(ridingStayOnHint(3, "Hynes", true), /stays on until you turn it off/);
  assert.doesNotMatch(ridingStayOnHint(1, "Hynes", true), /turns off at/);
});
