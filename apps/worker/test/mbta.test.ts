import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { T_STATIONS } from "@questline/t-map";
import {
  MBTA_BACKOFF_MAX_MS,
  MBTA_BACKOFF_MIN_MS,
  mbtaPollDelayAfterError,
  nextMbtaBackoffMs,
  parseRetryAfterMs,
} from "../src/mbta/client";
import { parseScheduleStops, parseTimeline } from "../src/mbta/predictions";
import { parseVehicles, routeToLine } from "../src/mbta/vehicles";
import { DEMO_STOPS, DEMO_STOPS_B, demoTimeline, demoTripInfo, newDemoClock } from "../src/mbta/demo";
import type { StopInfo } from "../src/rooms/state";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../src/mbta/__fixtures__/${name}`, import.meta.url), "utf8"));
const catalogId = (mbtaId: string) => T_STATIONS.find((s) => s.mbtaId === mbtaId)!.id;
const at = (iso: string) => Date.parse(iso);

// ---- vehicles: car label -> trip ----

test("every carriage label of a live train resolves to that train's trip", () => {
  const byCar = parseVehicles(fixture("vehicles-orange-red.json"));
  for (const car of ["1446", "1447", "1482", "1483", "1431", "1430"]) assert.equal(byCar.get(car)?.tripId, "79808057");
  for (const car of ["1416", "1417", "1408", "1409", "1513", "1512"]) assert.equal(byCar.get(car)?.tripId, "79808054");
  assert.equal(byCar.get("9999"), undefined);
});

test("a live trip keeps MBTA's carriage order, its line and direction, and is not a demo", () => {
  const trip = parseVehicles(fixture("vehicles-orange-red.json")).get("1482")!;
  assert.deepEqual(trip.carOrder, ["1446", "1447", "1482", "1483", "1431", "1430"]);
  assert.equal(trip.line, "Orange");
  assert.equal(trip.routeId, "Orange");
  assert.equal(trip.directionId, 1);
  assert.equal(trip.demo, false);
});

test("vehicles without carriages or a trip are skipped", () => {
  const doc = fixture("vehicles-orange-red.json");
  doc.data[0].attributes.carriages = [];
  delete doc.data[1].relationships.trip;
  assert.equal(parseVehicles(doc).size, 0);
});

test("route ids map to protocol lines, and other modes are ignored", () => {
  assert.equal(routeToLine("Red"), "Red");
  assert.equal(routeToLine("Orange"), "Orange");
  assert.equal(routeToLine("Green-D"), "Green-D");
  assert.equal(routeToLine("CR-Fitchburg"), null);
});

// ---- predictions: the trip's stops, next stop, ETA and delay ----

test("predictions become catalog stops in order, with skipped stops dropped", () => {
  const tl = parseTimeline(fixture("predictions-synthetic.json"), [], at("2099-01-01T11:40:00-05:00"))!;
  assert.deepEqual(
    tl.stops.map((s) => s.stopId),
    ["place-ogmnl", "place-mlmnl", "place-astao"].map(catalogId),
  );
  assert.equal(tl.stops[0]!.name, "Oak Grove");
});

test("the next stop is the first one still ahead, and the current stop is the one before", () => {
  const tl = parseTimeline(fixture("predictions-synthetic.json"), [], at("2099-01-01T12:00:00-05:00"))!;
  assert.equal(tl.stops[tl.nextStopIdx!]!.name, "Malden Center");
  assert.equal(tl.currentStopIdx, tl.nextStopIdx! - 1);
  assert.equal(tl.nextStopEtaMs, at("2099-01-01T12:10:00-05:00"));
});

test("once every stop is in the past the trip sits at its last stop with no next stop", () => {
  const tl = parseTimeline(fixture("predictions-synthetic.json"), [], at("2099-01-01T13:00:00-05:00"))!;
  assert.equal(tl.nextStopIdx, null);
  assert.equal(tl.currentStopIdx, tl.stops.length - 1);
  assert.equal(tl.nextStopEtaMs, null);
});

test("an empty poll returns null so the room can tell the trip may have ended", () => {
  assert.equal(parseTimeline({ data: [], included: [] }, [], Date.now()), null);
});

test("stops already passed stay in place so riders' stop indexes don't shift", () => {
  const passed: StopInfo[] = [{ stopId: "earlier", name: "Earlier", sequence: 0, etaMs: 123 }];
  const tl = parseTimeline(fixture("predictions-synthetic.json"), passed, at("2099-01-01T11:40:00-05:00"))!;
  assert.equal(tl.stops[0]!.stopId, "earlier");
  assert.equal(tl.stops[0]!.etaMs, null, "a passed stop has no ETA");
  assert.equal(tl.stops.length, 4);
});

test("delay is predicted minus scheduled arrival at the next stop, never negative", () => {
  const doc = fixture("predictions-synthetic.json");
  const sched = doc.included.find((r: { type: string; id: string }) => r.type === "schedule" && r.id === "sch2");
  sched.attributes.arrival_time = "2099-01-01T12:04:00-05:00"; // predicted 12:10 -> 6 minutes late
  assert.equal(parseTimeline(doc, [], at("2099-01-01T12:00:00-05:00"))!.delaySec, 360);
  sched.attributes.arrival_time = "2099-01-01T12:15:00-05:00"; // early: no negative delay
  assert.equal(parseTimeline(doc, [], at("2099-01-01T12:00:00-05:00"))!.delaySec, 0);
});

// ---- schedules: the full stop list to seed a trip ----

test("schedules seed the trip's full stop list in order, mapped to catalog ids", () => {
  const stops = parseScheduleStops(fixture("schedules-trip.json"));
  assert.equal(stops[0]!.stopId, catalogId("place-forhl"));
  assert.equal(stops[0]!.name, "Forest Hills");
  assert.ok(stops.every((s, i) => i === 0 || s.sequence > stops[i - 1]!.sequence));
  assert.equal(new Set(stops.map((s) => s.stopId)).size, stops.length, "no stop twice");
});

// ---- resilience: Retry-After and poll backoff ----

test("parseRetryAfterMs reads delay-seconds and HTTP-date, ignores junk", () => {
  assert.equal(parseRetryAfterMs("30"), 30_000);
  assert.equal(parseRetryAfterMs(null), null);
  assert.equal(parseRetryAfterMs("nope"), null);
  const now = Date.parse("2099-01-01T12:00:00Z");
  assert.equal(parseRetryAfterMs("Thu, 01 Jan 2099 12:00:45 GMT", now), 45_000);
  assert.equal(parseRetryAfterMs("0"), 0);
});

test("nextMbtaBackoffMs starts at 20s and doubles up to 2 minutes", () => {
  assert.equal(nextMbtaBackoffMs(null), MBTA_BACKOFF_MIN_MS);
  assert.equal(nextMbtaBackoffMs(MBTA_BACKOFF_MIN_MS), 40_000);
  assert.equal(nextMbtaBackoffMs(40_000), 80_000);
  assert.equal(nextMbtaBackoffMs(80_000), MBTA_BACKOFF_MAX_MS);
  assert.equal(nextMbtaBackoffMs(MBTA_BACKOFF_MAX_MS), MBTA_BACKOFF_MAX_MS);
});

test("mbtaPollDelayAfterError prefers Retry-After, else the backoff ladder", () => {
  assert.equal(mbtaPollDelayAfterError({ retryAfterMs: 12_000 }, null), 12_000);
  assert.equal(mbtaPollDelayAfterError({ retryAfterMs: null }, null), MBTA_BACKOFF_MIN_MS);
  assert.equal(mbtaPollDelayAfterError({}, 40_000), 80_000);
});

// ---- scripted demo trips (DEMO_LINE) ----

test("both demo trips only use stops from the station catalog", () => {
  const ids = new Set(T_STATIONS.map((s) => s.id));
  for (const s of [...DEMO_STOPS, ...DEMO_STOPS_B]) assert.ok(ids.has(s.stopId), `${s.stopId} is not in the catalog`);
});

test("DEMO_LINE Green-B runs Blandford St to Boston College; the default is the Green-D stage trip", () => {
  const clock = newDemoClock(0);
  const b = demoTimeline(clock, 0, "Green-B");
  assert.equal(b.stops[0]!.name, "Blandford St");
  assert.equal(b.stops.at(-1)!.name, "Boston College");
  assert.equal(b.stops[b.nextStopIdx!]!.name, "BU East");
  assert.equal(demoTimeline(clock, 0).stops[0]!.name, "Kenmore");
  assert.equal(demoTripInfo("t", "Green-B").line, "Green-B");
  assert.equal(demoTripInfo("t").line, "Green-D");
});

test("the Green-B demo trip lasts long enough to play all three games", () => {
  const totalSec = DEMO_STOPS_B.reduce((t, s) => t + s.segmentSec, 0);
  assert.ok(totalSec >= 20 * 60, `only ${totalSec} s`);
});
