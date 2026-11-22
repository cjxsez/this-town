import test from "node:test";
import assert from "node:assert/strict";
import type { Mission } from "@questline/protocol";
import { clockOffsetMs, initialKioskState, onKioskEvent, reduceKiosk, type KioskState } from "../src/state";

const AT = 1_000_000;

function mission(endsAt = AT + 60_000): Mission {
  return {
    sessionId: "ses1",
    templateId: "t1",
    category: "spot",
    title: "Look",
    prompt: "Find it",
    endsAt,
    rare: false,
  };
}

function idleEvent(patch: Partial<{ nextStopEtaSec: number | null; serverNow: number }> = {}) {
  return {
    type: "kiosk.idle" as const,
    ridersInCar: 2,
    ridersOnTrain: 5,
    nextStop: "Hynes",
    nextStopEtaSec: 90 as number | null,
    serverNow: AT + 250,
    ...patch,
  };
}

test("kiosk.idle only updates stats and nextStopAt, never the pair screen", () => {
  let s: KioskState = onKioskEvent(initialKioskState, {
    type: "pair.incoming",
    matchId: "m1",
    color: "orange",
    firstNames: ["Ada", "Bo"],
    arrived: 0,
  }, AT);
  assert.equal(s.screen.name, "pair");
  s = onKioskEvent(s, idleEvent(), AT);
  assert.equal(s.screen.name, "pair");
  assert.equal(s.stats?.ridersInCar, 2);
  assert.equal(s.stats?.nextStop, "Hynes");
  assert.equal(s.nextStopAt, AT + 90_000);
});

test("a second pair.incoming with a different matchId replaces the first", () => {
  let s = onKioskEvent(initialKioskState, {
    type: "pair.incoming",
    matchId: "m1",
    color: "orange",
    firstNames: ["Ada", "Bo"],
    arrived: 0,
  }, AT);
  s = onKioskEvent(s, {
    type: "pair.incoming",
    matchId: "m2",
    color: "green",
    firstNames: ["Cy", "Di"],
    arrived: 1,
  }, AT + 1);
  assert.equal(s.screen.name, "pair");
  if (s.screen.name !== "pair") throw new Error("expected pair");
  assert.equal(s.screen.matchId, "m2");
  assert.equal(s.pairs.m2?.color, "green");
  assert.ok(s.pairs.m1);
});

test("pair.cleared for an old matchId leaves the current pair", () => {
  let s = onKioskEvent(initialKioskState, {
    type: "pair.incoming",
    matchId: "m1",
    color: "orange",
    firstNames: ["Ada", "Bo"],
    arrived: 0,
  }, AT);
  s = onKioskEvent(s, {
    type: "pair.incoming",
    matchId: "m2",
    color: "green",
    firstNames: ["Cy", "Di"],
    arrived: 0,
  }, AT);
  s = onKioskEvent(s, { type: "pair.cleared", matchId: "m1" }, AT);
  assert.equal(s.screen.name, "pair");
  if (s.screen.name !== "pair") throw new Error("expected pair");
  assert.equal(s.screen.matchId, "m2");
  assert.equal(s.pairs.m1, undefined);
  assert.ok(s.pairs.m2);
});

test("mission.show then celebrate then pair.cleared returns to idle", () => {
  let s = onKioskEvent(initialKioskState, {
    type: "pair.incoming",
    matchId: "m1",
    color: "orange",
    firstNames: ["Ada", "Bo"],
    arrived: 2,
  }, AT);
  s = onKioskEvent(s, {
    type: "mission.show",
    matchId: "m1",
    color: "orange",
    mission: mission(),
    serverNow: AT,
  }, AT);
  assert.equal(s.screen.name, "mission");
  s = onKioskEvent(s, { type: "celebrate", matchId: "m1", color: "orange", rare: false }, AT);
  assert.equal(s.screen.name, "celebrate");
  // During celebrate, pair.cleared is deferred until celebrateDone.
  s = onKioskEvent(s, { type: "pair.cleared", matchId: "m1" }, AT);
  assert.equal(s.screen.name, "celebrate");
  s = reduceKiosk(s, { type: "celebrateDone", matchId: "m1" });
  assert.equal(s.screen.name, "idle");
  assert.equal(s.pairs.m1, undefined);
});

test("games only (D28): the pair screen goes straight to celebrate when they finish, then idle", () => {
  let s = onKioskEvent(initialKioskState, {
    type: "pair.incoming",
    matchId: "m1",
    color: "orange",
    firstNames: ["Ada", "Bo"],
    arrived: 2,
  }, AT);
  assert.equal(s.screen.name, "pair");
  s = onKioskEvent(s, { type: "celebrate", matchId: "m1", color: "orange", rare: false }, AT);
  assert.equal(s.screen.name, "celebrate");
  s = onKioskEvent(s, { type: "pair.cleared", matchId: "m1" }, AT);
  s = reduceKiosk(s, { type: "celebrateDone", matchId: "m1" });
  assert.equal(s.screen.name, "idle");
  assert.equal(s.pairs.m1, undefined);
});

test("clock offset from serverNow is serverNow - clientNow", () => {
  const event = idleEvent({ serverNow: AT + 400 });
  assert.equal(clockOffsetMs(event.serverNow, AT), 400);
});
