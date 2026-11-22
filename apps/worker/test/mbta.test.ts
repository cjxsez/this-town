import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { T_STATIONS } from "@questline/t-map";
import { parseScheduleStops, parseTimeline } from "../src/mbta/predictions";
import { parseVehicles, routeToLine } from "../src/mbta/vehicles";
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
