import test from "node:test";
import assert from "node:assert/strict";
import { RAW_STOPS } from "../src/generated/network";
import { T_ROUTES, T_STATIONS, stationsOn, tStation, ticketLines } from "../src/stations";

test("the catalog has every MBTA subway and light-rail station, each once", () => {
  assert.equal(T_STATIONS.length, RAW_STOPS.length);
  assert.equal(T_STATIONS.length, 124);
  assert.equal(new Set(T_STATIONS.map((s) => s.id)).size, 124);
  assert.equal(new Set(T_STATIONS.map((s) => s.mbtaId)).size, 124);
});

test("ids are lowercase slugs", () => {
  for (const s of T_STATIONS) assert.match(s.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, s.id);
});

test("the first catalog's ids still exist, so stored stamps keep working", () => {
  const legacy = ["kenmore", "bu-east", "bu-central", "amory", "babcock", "blandford", "hynes", "copley", "arlington", "boylston", "park-st", "gov-ctr", "downtown-crossing", "harvard", "aquarium"];
  for (const id of legacy) assert.ok(tStation(id), id);
  assert.equal(tStation("gov-ctr")!.fullName, "Government Center");
  assert.equal(tStation("bu-east")!.fullName, "Boston University East");
});

test("each line has the right number of stations", () => {
  assert.equal(stationsOn("red").length, 22);
  assert.equal(stationsOn("mattapan").length, 8);
  assert.equal(stationsOn("orange").length, 20);
  assert.equal(stationsOn("blue").length, 12);
  assert.equal(stationsOn("green").length, 69);
  assert.equal(stationsOn("green", "B").length, 23);
  assert.equal(stationsOn("green", "C").length, 19);
  assert.equal(stationsOn("green", "D").length, 25);
  assert.equal(stationsOn("green", "E").length, 25);
});

test("stations are listed in travel order", () => {
  assert.deepEqual(stationsOn("blue").map((s) => s.id).slice(0, 3), ["wonderland", "revere-beach", "beachmont"]);
  const red = T_ROUTES.find((r) => r.id === "Red")!;
  assert.equal(red.patterns.length, 2);
  assert.deepEqual(red.patterns[0]!.slice(-2), ["quincy-adams", "braintree"]);
  assert.deepEqual(red.patterns[1]!.slice(-2), ["shawmut", "ashmont"]);
});

test("transfer stations are on both of their lines", () => {
  const lines = (id: string) => tStation(id)!.lines;
  assert.deepEqual(lines("park-st"), ["red", "green"]);
  assert.deepEqual(lines("downtown-crossing"), ["red", "orange"]);
  assert.deepEqual(lines("state"), ["orange", "blue"]);
  assert.deepEqual(lines("gov-ctr"), ["blue", "green"]);
  assert.deepEqual(lines("north-station"), ["orange", "green"]);
  assert.deepEqual(lines("haymarket"), ["orange", "green"]);
  assert.deepEqual(lines("ashmont"), ["red", "mattapan"]);
});

test("Green Line branches are recorded per station", () => {
  assert.deepEqual(tStation("kenmore")!.branches, ["B", "C", "D"]);
  assert.deepEqual(tStation("copley")!.branches, ["B", "C", "D", "E"]);
  assert.deepEqual(tStation("lechmere")!.branches, ["D", "E"]);
  assert.deepEqual(tStation("union-sq")!.branches, ["D"]);
  assert.deepEqual(tStation("medford-tufts")!.branches, ["E"]);
  assert.equal(tStation("harvard")!.branches, undefined);
});

test("Fairbanks St is gone and Symphony is marked shut", () => {
  assert.equal(T_STATIONS.find((s) => /fairbanks/i.test(s.fullName)), undefined);
  assert.match(tStation("symphony")!.suspended ?? "", /2029/);
  assert.equal(T_STATIONS.filter((s) => s.suspended).length, 1);
});

test("ticket labels fit a ticket: one or two lines of at most 7 characters", () => {
  for (const s of T_STATIONS) {
    const lines = ticketLines(s.short);
    assert.ok(lines.length <= 2, s.short);
    for (const l of lines) assert.ok(l.length <= 7, `${s.id}: "${l}"`);
  }
});
