// api/backend/map.ts: the worker's wire shapes to the screens' shapes and back.
import test from "node:test";
import assert from "node:assert/strict";
import {
  fromLine,
  fromWireProfile,
  stationIdFor,
  toCheckIn,
  toInterestTags,
  toMission,
  toPerson,
  toStamp,
  toWireProfile,
} from "../src/api/backend/map";

test("unknown interests are dropped and at most eight are sent", () => {
  assert.deepEqual(toInterestTags(["ramen", "not-a-tag", "film"]), ["ramen", "film"]);
  const many = ["ramen", "film", "coffee", "chess", "anime", "baking", "hiking", "trivia", "rowing", "comics"];
  assert.equal(toInterestTags(many).length, 8);
});

test("a profile survives the round trip to the worker and back", () => {
  const wire = toWireProfile({
    id: "u1",
    firstName: "Maya",
    kind: "student",
    is18: true,
    interests: ["ramen", "film"],
    askMeAbout: "the best ramen in Allston",
    battery: "chat",
    rulesAccepted: true,
    glassesLinked: false,
    createdAt: "",
  });
  assert.deepEqual(wire, {
    firstName: "Maya",
    interests: ["ramen", "film"],
    askMeAbout: "the best ramen in Allston",
    socialBattery: "chat",
    status: "student",
    languages: [],
    is18Plus: true,
  });
  const back = fromWireProfile(wire, { userId: "usr_1", email: "maya@example.test" });
  assert.equal(back.id, "usr_1");
  assert.equal(back.email, "maya@example.test");
  assert.deepEqual([back.firstName, back.kind, back.battery], ["Maya", "student", "chat"]);
});

test("names and ask-me-about are cut to what the worker accepts", () => {
  const wire = toWireProfile({ firstName: "x".repeat(40), askMeAbout: "y".repeat(200), interests: [], kind: "local", battery: "nod" } as never);
  assert.equal(wire.firstName.length, 24);
  assert.equal(wire.askMeAbout.length, 80);
});

test("Green Line branches split into the line and the branch letter", () => {
  assert.deepEqual(fromLine("Green-D"), { line: "green", branch: "D" });
  assert.deepEqual(fromLine("Orange"), { line: "orange" });
});

test("a stop name without an id still finds the catalog station", () => {
  assert.equal(stationIdFor("Hynes"), "hynes");
  assert.equal(stationIdFor("Government Center"), "gov-ctr");
});

test("the check-in prefers the worker's stop ids over names", () => {
  const c = toCheckIn({
    status: "riding",
    tripId: "t",
    line: "Green-D",
    car: "1412",
    destinationStop: "Government Ctr",
    destinationStopId: "gov-ctr",
    nextStop: "Hynes",
    nextStopId: "hynes",
    nextStopEtaSec: 60,
    ridersOnTrain: 4,
    ghost: false,
  } as never);
  assert.deepEqual(c, {
    car: "1412",
    line: "green",
    branch: "D",
    nextStationId: "hynes",
    nextStationName: "Hynes",
    destinationId: "gov-ctr",
    destinationName: "Government Ctr",
  });
});

test("a mission's seconds count down from now, and late-bonus missions are flagged", () => {
  const m = toMission({ sessionId: "s", templateId: "t", category: "late-bonus", title: "T", prompt: "P", endsAt: 10_000, rare: true }, 4_000);
  assert.deepEqual([m.seconds, m.group, m.rarity, m.delayOnly], [6, "lateBonus", "rare", true]);
  assert.equal(toMission({ sessionId: "s", templateId: "t", category: "spot", title: "T", prompt: "P", endsAt: 0, rare: false }, 4_000).seconds, 0);
});

test("a stamp keeps the worker's station id and the person it was earned with", () => {
  const s = toStamp(
    { id: "stp", stationId: "hynes", station: "Hynes", line: "Green-D", partnerFirstName: "Maya", rare: false, awardedAt: 0 },
    { matchId: "mat_1" },
  );
  assert.deepEqual([s.stationId, s.line, s.branch, s.withFirstName, s.withPersonId], ["hynes", "green", "D", "Maya", "mat_1"]);
});

test("a person from recent matches carries where you met and whether you blocked them", () => {
  const p = toPerson({ matchId: "mat_1", partnerFirstName: "Maya", color: "orange", line: "Green-D", at: 0, stamped: true, stationId: "hynes", blocked: true });
  assert.deepEqual([p.id, p.metAtStationId, p.quests, p.blocked], ["mat_1", "hynes", 1, true]);
  const unstamped = toPerson({ matchId: "mat_2", partnerFirstName: "Leo", color: "blue", line: "Red", at: 0, stamped: false, stationId: null, blocked: false });
  assert.deepEqual([unstamped.metAtStationId, unstamped.quests, unstamped.blocked], ["", 0, false]);
});
