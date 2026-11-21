/**
 * mbta/demo.ts: the scripted demo trip used when DEMO_MODE = "true".
 *
 * Responsible for:
 * - `demoTripInfo()`: TripInfo for the demo trip (Green Line D inbound, cars 1413 front,
 *   1412 behind, so a rider in 1412 sees "kiosk 1 car forward" for 1413).
 * - `DEMO_STOPS`: Kenmore to Government Center, using the phone's station catalog ids.
 * - `demoTimeline(clock, now)`: deterministic TripTimeline from a DemoClock. A triggered
 *   delay (POST /api/demo/delay) pushes every future ETA back and reports delaySec, which
 *   unlocks the late-train bonus once it exceeds LATE_BONUS_MIN_DELAY_S. POST
 *   /api/demo/advance skips to the next stop. When the trip reaches its last stop and
 *   nobody is left on it, the next check-in restarts the clock from Kenmore.
 *
 * TrainRoom uses this instead of mbta/predictions.ts when state.trip.demo is true.
 *
 * Protocol types: CarId, Line.
 *
 */
import type { CarId, Line } from "@questline/protocol";
import { SECOND } from "../lib/time";
import type { DemoClock, StopInfo, TripInfo, TripTimeline } from "../rooms/state";

export const DEMO_TRIP_ID = "demo-trip-1";
export const DEMO_LINE: Line = "Green-D";
/** Front of the train first. */
export const DEMO_CAR_ORDER: CarId[] = ["1413", "1412"];
export const DEMO_DEFAULT_DELAY_SEC = 240;

/**
 * Green Line D branch inbound, Kenmore to Government Center. Stop ids are the phone's
 * station catalog ids (apps/phone-web/shared/catalog.ts) so stamps get the right art.
 * segmentSec is the time from the previous stop. The first segment is long so a demo has
 * time to match, walk to the kiosk and play before Hynes; POST /api/demo/advance skips ahead.
 */
export const DEMO_STOPS: readonly { stopId: string; name: string; segmentSec: number }[] = [
  { stopId: "kenmore", name: "Kenmore", segmentSec: 0 },
  { stopId: "hynes", name: "Hynes", segmentSec: 360 },
  { stopId: "copley", name: "Copley", segmentSec: 240 },
  { stopId: "arlington", name: "Arlington", segmentSec: 180 },
  { stopId: "boylston", name: "Boylston", segmentSec: 150 },
  { stopId: "park-st", name: "Park St", segmentSec: 150 },
  { stopId: "gov-ctr", name: "Government Ctr", segmentSec: 180 },
];

export function demoTripInfo(tripId: string): TripInfo {
  return {
    tripId,
    line: DEMO_LINE,
    routeId: "Green-D",
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
  // Land just past the next stop so the room sees the arrival on this tick.
  const jump = Math.max(0, tl.nextStopEtaMs - now + SECOND);
  return { ...clock, skipMs: clock.skipMs + jump };
}
