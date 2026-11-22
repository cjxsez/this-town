import test from "node:test";
import assert from "node:assert/strict";
import type { MatchInfo, Mission, RideState, Stamp } from "@questline/protocol";
import { initGlassesState, onGlassesEvent, reduceGlasses, type GlassesState } from "../src/state";

const AT = 2_000_000;

function ride(patch: Partial<RideState> = {}): RideState {
  return {
    status: "matched",
    tripId: "t1",
    line: "Orange",
    car: "1412",
    destinationStop: "Oak Grove",
    destinationStopId: "oak-grove",
    nextStop: "Hynes",
    nextStopId: "hynes",
    nextStopEtaSec: 120,
    ridersOnTrain: 4,
    ghost: false,
    ...patch,
  };
}

function matchInfo(patch: Partial<MatchInfo> = {}): MatchInfo {
  return {
    matchId: "m1",
    partner: { firstName: "Maya", color: "orange", sharedTags: ["ramen"] },
    why: "You both like ramen",
    meetAtCar: "1413",
    carDelta: 1,
    youWalk: true,
    ...patch,
  };
}

function mission(patch: Partial<Mission> = {}): Mission {
  return {
    sessionId: "ses1",
    templateId: "t1",
    category: "spot",
    title: "Sign spotter",
    prompt: "Spot the sign",
    endsAt: AT + 45_000,
    rare: false,
    ...patch,
  };
}

function stamp(): Stamp {
  return {
    id: "stp1",
    stationId: "hynes",
    station: "Hynes",
    line: "Orange",
    partnerFirstName: "Maya",
    rare: false,
    awardedAt: AT,
  };
}

test("ride.snapshot with match and mission restores the right screen after a reload", () => {
  const idle = initGlassesState("tok");
  const withMatch = onGlassesEvent(idle, {
    type: "ride.snapshot",
    snapshot: { state: ride(), match: matchInfo(), mission: null, serverNow: AT },
  }, AT);
  assert.equal(withMatch.screen.name, "match");
  if (withMatch.screen.name !== "match") throw new Error("expected match");
  assert.equal(withMatch.screen.match.matchId, "m1");

  const withMission = onGlassesEvent(idle, {
    type: "ride.snapshot",
    snapshot: { state: ride({ status: "in-mission" }), match: matchInfo(), mission: mission(), serverNow: AT },
  }, AT);
  assert.equal(withMission.screen.name, "mission");
  if (withMission.screen.name !== "mission") throw new Error("expected mission");
  assert.equal(withMission.screen.mission.sessionId, "ses1");
  assert.equal(withMission.screen.partner?.firstName, "Maya");
});

test("stamp.progress shows 1 of 2 then both tapped", () => {
  let s: GlassesState = onGlassesEvent(initGlassesState("tok"), {
    type: "match.found",
    ...matchInfo(),
  }, AT);
  s = onGlassesEvent(s, { type: "mission.start", mission: mission(), serverNow: AT }, AT);
  s = onGlassesEvent(s, { type: "stamp.progress", sessionId: "ses1", tapped: 1 }, AT);
  assert.equal(s.screen.name, "mission");
  if (s.screen.name !== "mission") throw new Error("expected mission");
  assert.equal(s.screen.tapped, 1);
  s = onGlassesEvent(s, { type: "stamp.progress", sessionId: "ses1", tapped: 2 }, AT);
  if (s.screen.name !== "mission") throw new Error("expected mission");
  assert.equal(s.screen.tapped, 2);
});

test("mission.end stamped falls back to idle if no stamp.awarded (stampTimeout)", () => {
  let s = onGlassesEvent(initGlassesState("tok"), { type: "match.found", ...matchInfo() }, AT);
  s = onGlassesEvent(s, { type: "mission.start", mission: mission(), serverNow: AT }, AT);
  s = onGlassesEvent(s, { type: "mission.end", sessionId: "ses1", reason: "stamped" }, AT);
  assert.equal(s.screen.name, "mission");
  assert.equal(s.stampedAt, AT);
  s = reduceGlasses(s, { type: "stampTimeout" });
  assert.equal(s.screen.name, "idle");
  assert.equal(s.stampedAt, null);
});

test("match.cleared returns to idle", () => {
  let s = onGlassesEvent(initGlassesState("tok"), { type: "match.found", ...matchInfo() }, AT);
  assert.equal(s.screen.name, "match");
  s = onGlassesEvent(s, { type: "match.cleared", matchId: "m1", reason: "partner-not-now" }, AT);
  assert.equal(s.screen.name, "idle");
  assert.equal(s.match, null);
});

test("stamp.awarded wins over stamped timeout path", () => {
  let s = onGlassesEvent(initGlassesState("tok"), { type: "match.found", ...matchInfo() }, AT);
  s = onGlassesEvent(s, { type: "mission.start", mission: mission(), serverNow: AT }, AT);
  s = onGlassesEvent(s, { type: "mission.end", sessionId: "ses1", reason: "stamped" }, AT);
  s = onGlassesEvent(s, { type: "stamp.awarded", stamp: stamp() }, AT);
  assert.equal(s.screen.name, "stamp");
  assert.equal(s.stampedAt, null);
});
