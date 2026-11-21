/**
 * mbta/demo.ts: the scripted demo trip used when DEMO_MODE = "true".
 *
 * Responsible for:
 * - `demoTripInfo()`: TripInfo for the demo trip (Orange Line, cars 1413 front, 1412 behind,
 *   so a rider in 1412 sees "kiosk 1 car forward" for 1413, matching docs/demo-script.md).
 * - `DEMO_STOPS`: scripted northbound Orange Line stops with segment lengths. The first
 *   segment (Chinatown -> Downtown Crossing) is long so the match + mission + stamp fit.
 * - `demoTimeline(clock, now)`: deterministic TripTimeline from a DemoClock. A triggered
 *   delay (POST /api/demo/delay) pushes every future ETA back and reports delaySec, which
 *   unlocks the late-train bonus once it exceeds LATE_BONUS_MIN_DELAY_S. POST
 *   /api/demo/advance skips to the next stop.
 *
 * TrainRoom uses this instead of mbta/predictions.ts when state.trip.demo is true.
 *
 * Protocol types: CarId, Line.
 *
 * TODO:
 * - The demo script picks "Downtown Crossing" as the destination and then runs a late-bonus
 *   mission after the stamp. With that destination the rider is checked out at the next stop
 *   and post-mission matching waits a segment. Either pick a farther destination in the
 *   script (e.g. North Station) or have the presenter hit /api/demo/advance before step 6.
 */
import type { CarId, Line } from "@questline/protocol";
import { SECOND } from "../lib/time";
import type { DemoClock, StopInfo, TripInfo, TripTimeline } from "../rooms/state";

export const DEMO_TRIP_ID = "demo-trip-1";
export const DEMO_LINE: Line = "Orange";
/** Front of the train first. */
export const DEMO_CAR_ORDER: CarId[] = ["1413", "1412"];
/** Scripted delay used by the demo trigger when no amount is given. Above the 180 s default. */
export const DEMO_DEFAULT_DELAY_SEC = 240;

/** segmentSec = seconds from the previous stop to this one (0 for the first). */
export const DEMO_STOPS: readonly { stopId: string; name: string; segmentSec: number }[] = [
  { stopId: "place-chncl", name: "Chinatown", segmentSec: 0 },
  { stopId: "place-dwnxg", name: "Downtown Crossing", segmentSec: 420 },
  { stopId: "place-state", name: "State", segmentSec: 120 },
  { stopId: "place-haecl", name: "Haymarket", segmentSec: 150 },
  { stopId: "place-north", name: "North Station", segmentSec: 150 },
  { stopId: "place-ccmnl", name: "Community College", segmentSec: 150 },
  { stopId: "place-sull", name: "Sullivan Square", segmentSec: 150 },
  { stopId: "place-astao", name: "Assembly", segmentSec: 150 },
  { stopId: "place-welln", name: "Wellington", segmentSec: 150 },
  { stopId: "place-mlmnl", name: "Malden Center", segmentSec: 150 },
  { stopId: "place-ogmnl", name: "Oak Grove", segmentSec: 180 },
];

export function demoTripInfo(tripId: string): TripInfo {
  return {
    tripId,
    line: DEMO_LINE,
    routeId: "Orange",
    directionId: 1,
    carOrder: [...DEMO_CAR_ORDER],
    demo: true,
  };
}

export function newDemoClock(now: number): DemoClock {
  return { startedAt: now, delaySec: 0, skipMs: 0 };
}

/** Seconds after departure at which the train reaches stop i, ignoring delay. */
function offsetsSec(): number[] {
  const out: number[] = [];
  let t = 0;
  for (const s of DEMO_STOPS) {
    t += s.segmentSec;
    out.push(t);
  }
  return out;
}

export function demoTimeline(clock: DemoClock, now: number): TripTimeline {
  const offsets = offsetsSec();
  // The train "stands still" for the scripted delay, so subtract it from elapsed time.
  const elapsedSec = (now - clock.startedAt + clock.skipMs) / SECOND - clock.delaySec;
  let currentStopIdx = 0;
  offsets.forEach((o, i) => {
    if (o <= elapsedSec) currentStopIdx = i;
  });
  const nextStopIdx = currentStopIdx + 1 < DEMO_STOPS.length ? currentStopIdx + 1 : null;
  const etaFor = (i: number): number =>
    clock.startedAt - clock.skipMs + ((offsets[i] ?? 0) + clock.delaySec) * SECOND;
  const stops: StopInfo[] = DEMO_STOPS.map((s, i) => ({
    stopId: s.stopId,
    name: s.name,
    sequence: i + 1,
    etaMs: i > currentStopIdx ? etaFor(i) : null,
  }));
  return {
    stops,
    currentStopIdx,
    nextStopIdx,
    nextStopEtaMs: nextStopIdx === null ? null : etaFor(nextStopIdx),
    delaySec: clock.delaySec,
  };
}

/** Clock change for POST /api/demo/advance: jump to 5 s before the next stop. */
export function advanceDemoClock(clock: DemoClock, now: number): DemoClock {
  const tl = demoTimeline(clock, now);
  if (tl.nextStopEtaMs === null) return clock;
  const jump = Math.max(0, tl.nextStopEtaMs - now - 5 * SECOND);
  return { ...clock, skipMs: clock.skipMs + jump };
}
