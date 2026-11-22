import test from "node:test";
import assert from "node:assert/strict";
import { matchArrivedStatus } from "../src/lib/matchCopy";
import { initGlassesState, reduceGlasses } from "../src/state";
import type { MatchInfo } from "@questline/protocol";

test("matchArrivedStatus names the partner", () => {
  assert.equal(matchArrivedStatus("Maya"), "You're here. Waiting for Maya");
});

test("reduceGlasses arrived flips the match screen flag", () => {
  const match: MatchInfo = {
    matchId: "m1",
    partner: { firstName: "Maya", color: "orange", sharedTags: ["ramen"] },
    why: "You both like ramen",
    meetAtCar: "1413",
    carDelta: 1,
    youWalk: true,
  };
  let s = initGlassesState("tok");
  s = reduceGlasses(s, {
    type: "event",
    event: { type: "match.found", ...match },
    at: 1,
  });
  assert.equal(s.screen.name, "match");
  if (s.screen.name !== "match") throw new Error("expected match");
  assert.equal(s.screen.arrived, false);
  s = reduceGlasses(s, { type: "arrived" });
  assert.equal(s.screen.name, "match");
  if (s.screen.name !== "match") throw new Error("expected match");
  assert.equal(s.screen.arrived, true);
  assert.equal(matchArrivedStatus(s.screen.match.partner.firstName), "You're here. Waiting for Maya");
});
