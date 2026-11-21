/**
 * mbta/predictions.ts: a trip's stops, next stop, ETA and delay.
 *
 * Responsible for:
 * - `fetchTripTimeline(env, tripId)`: GET /predictions?filter[trip]=<id>&include=stop,schedule
 *   &sort=stop_sequence, then map to a TripTimeline:
 *     stops        ordered by stop_sequence, name = parent station name (stop.attributes.name)
 *     nextStopIdx  first stop whose predicted arrival is in the future
 *     currentStopIdx = nextStopIdx - 1 (or the last stop when the trip is done)
 *     nextStopEtaMs  arrival_time (fall back to departure_time) of the next stop
 *     delaySec     predicted minus scheduled arrival for the next stop (schedule include)
 * - Stops already passed drop out of /predictions, so merge with the room's previous stops
 *   (TrainRoom passes them in) to keep boardedStop / destination indexes stable. If needed,
 *   seed the full list once from /schedules?filter[trip]=<id>&include=stop.
 *
 * Called by TrainRoom.alarm() every ~20 s while anyone is checked in (never in demo trips).
 *
 * Protocol types: none directly; feeds RideState.nextStop / nextStopEtaSec and
 * KioskIdleEvent.nextStop / nextStopEtaSec, and the late-bonus unlock.
 *
 * TODO:
 * - Implement both functions.
 * - Handle schedule_relationship "SKIPPED" / "CANCELLED" (drop the stop) and trips that
 *   vanish (TrainRoom treats an empty result for ~2 polls as trip-ended).
 */
import type { Env } from "../env";
import type { StopInfo, TripTimeline } from "../rooms/state";
import { mbtaGet, type JsonApiDoc } from "./client";

export interface PredictionAttrs {
  arrival_time: string | null;
  departure_time: string | null;
  stop_sequence: number;
  schedule_relationship: string | null;
  status: string | null;
}

export async function fetchTripTimeline(
  env: Env,
  tripId: string,
  previousStops: StopInfo[],
  now: number,
): Promise<TripTimeline> {
  const doc = await mbtaGet<PredictionAttrs>(env, "/predictions", {
    "filter[trip]": tripId,
    include: "stop,schedule",
    sort: "stop_sequence",
  });
  return timelineFromPredictions(doc, previousStops, now);
}

export function timelineFromPredictions(
  doc: JsonApiDoc<PredictionAttrs>,
  previousStops: StopInfo[],
  now: number,
): TripTimeline {
  throw new Error("TODO: map predictions + included stops/schedules to TripTimeline");
}
