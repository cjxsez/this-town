/**
 * mbta/predictions.ts: a trip's stops, next stop, ETA and delay.
 *
 * Responsible for:
 * - `fetchTripTimeline(env, tripId, previousStops)`: GET /predictions?filter[trip]=<id>
 *   &include=stop,schedule&sort=stop_sequence. When previousStops is empty, seed once from
 *   /schedules?filter[trip]=<id>&include=stop so boardedStop / destination indexes stay
 *   stable as predictions drop stops the train has passed.
 * - `parseTimeline(doc, previousStops, now)`: pure JSON:API -> TripTimeline (fixtures).
 * - Drop schedule_relationship SKIPPED / CANCELLED.
 * - Stop ids map through packages/t-map (parent station mbtaId -> catalog id).
 *
 * Called by TrainRoom.alarm() every ~20 s while anyone is checked in (never in demo trips).
 * Returns null when the predictions document has no usable rows (TrainRoom counts empty
 * polls toward trip-ended).
 *
 * Protocol types: none directly; feeds RideState.nextStop / nextStopEtaSec and
 * KioskIdleEvent.nextStop / nextStopEtaSec, and the late-bonus unlock.
 */
import { T_STATIONS } from "@questline/t-map";
import type { Env } from "../env";
import type { StopInfo, TripTimeline } from "../rooms/state";
import { mbtaGet, type JsonApiDoc, type JsonApiResource } from "./client";

export interface PredictionAttrs {
  arrival_time: string | null;
  departure_time: string | null;
  stop_sequence: number;
  schedule_relationship: string | null;
  status: string | null;
}

export interface ScheduleAttrs {
  arrival_time: string | null;
  departure_time: string | null;
  stop_sequence: number;
}

export interface StopAttrs {
  name: string;
  platform_name?: string | null;
}

const DROPPED = new Set(["SKIPPED", "CANCELLED"]);

const byMbtaId = new Map(T_STATIONS.map((s) => [s.mbtaId, s]));

function includedMap(doc: JsonApiDoc<unknown>): Map<string, JsonApiResource> {
  const map = new Map<string, JsonApiResource>();
  for (const res of doc.included ?? []) map.set(`${res.type}:${res.id}`, res);
  return map;
}

function refId(rel: { data: { id: string; type: string } | { id: string; type: string }[] | null } | undefined): string | null {
  const data = rel?.data;
  if (!data || Array.isArray(data)) return null;
  return data.id;
}

function parseTimeMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** Map an MBTA stop resource to the protocol catalog stop id + display name. */
export function catalogStopFromMbta(
  stop: JsonApiResource<StopAttrs> | undefined,
  included: Map<string, JsonApiResource>,
): { stopId: string; name: string } | null {
  if (!stop) return null;
  const parentRef = stop.relationships?.parent_station?.data;
  const parentId = !Array.isArray(parentRef) && parentRef ? parentRef.id : null;
  const parent = parentId ? (included.get(`stop:${parentId}`) as JsonApiResource<StopAttrs> | undefined) : undefined;
  const placeId = parentId ?? (stop.id.startsWith("place-") ? stop.id : null);
  const catalog = placeId ? byMbtaId.get(placeId) : undefined;
  const name = catalog?.name ?? parent?.attributes?.name ?? stop.attributes?.name ?? stop.id;
  const stopId = catalog?.id ?? placeId ?? stop.id;
  return { stopId, name };
}

interface LiveStop {
  stopId: string;
  name: string;
  sequence: number;
  etaMs: number | null;
  scheduledMs: number | null;
}

function liveStopsFromPredictions(doc: JsonApiDoc<PredictionAttrs>): LiveStop[] {
  const included = includedMap(doc);
  const out: LiveStop[] = [];
  for (const pred of doc.data) {
    const rel = pred.attributes.schedule_relationship;
    if (rel && DROPPED.has(rel)) continue;
    const stopId = refId(pred.relationships?.stop);
    if (!stopId) continue;
    const stop = included.get(`stop:${stopId}`) as JsonApiResource<StopAttrs> | undefined;
    const catalog = catalogStopFromMbta(stop, included);
    if (!catalog) continue;
    const etaMs =
      parseTimeMs(pred.attributes.arrival_time) ?? parseTimeMs(pred.attributes.departure_time);
    const schedId = refId(pred.relationships?.schedule);
    const sched = schedId
      ? (included.get(`schedule:${schedId}`) as JsonApiResource<ScheduleAttrs> | undefined)
      : undefined;
    const scheduledMs =
      parseTimeMs(sched?.attributes?.arrival_time) ?? parseTimeMs(sched?.attributes?.departure_time);
    out.push({
      stopId: catalog.stopId,
      name: catalog.name,
      sequence: pred.attributes.stop_sequence,
      etaMs,
      scheduledMs,
    });
  }
  out.sort((a, b) => a.sequence - b.sequence);
  return out;
}

/** Pure: seed StopInfo[] from a /schedules JSON:API document (ordered by stop_sequence). */
export function parseScheduleStops(doc: JsonApiDoc<ScheduleAttrs>): StopInfo[] {
  const included = includedMap(doc);
  const rows: StopInfo[] = [];
  for (const sched of doc.data) {
    const stopId = refId(sched.relationships?.stop);
    if (!stopId) continue;
    const stop = included.get(`stop:${stopId}`) as JsonApiResource<StopAttrs> | undefined;
    const catalog = catalogStopFromMbta(stop, included);
    if (!catalog) continue;
    rows.push({
      stopId: catalog.stopId,
      name: catalog.name,
      sequence: sched.attributes.stop_sequence,
      etaMs: parseTimeMs(sched.attributes.arrival_time) ?? parseTimeMs(sched.attributes.departure_time),
    });
  }
  rows.sort((a, b) => a.sequence - b.sequence);
  // Deduplicate by stopId, keeping earliest sequence.
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.stopId)) return false;
    seen.add(r.stopId);
    return true;
  });
}

/**
 * Pure: map predictions (+ optional previous stops) to a TripTimeline.
 * Returns null when there are no usable prediction rows (empty poll).
 */
export function parseTimeline(
  doc: JsonApiDoc<PredictionAttrs>,
  previousStops: StopInfo[],
  now: number,
): TripTimeline | null {
  const live = liveStopsFromPredictions(doc);
  if (live.length === 0) return null;

  const firstSeq = live[0]!.sequence;
  const kept = previousStops.filter((s) => s.sequence < firstSeq);
  const byId = new Map<string, StopInfo>();
  for (const s of kept) byId.set(s.stopId, { ...s, etaMs: null });
  for (const s of live) {
    byId.set(s.stopId, {
      stopId: s.stopId,
      name: s.name,
      sequence: s.sequence,
      etaMs: s.etaMs,
    });
  }
  const stops = [...byId.values()].sort((a, b) => a.sequence - b.sequence);

  let nextStopIdx: number | null = null;
  for (let i = 0; i < stops.length; i++) {
    const eta = stops[i]!.etaMs;
    if (eta !== null && eta > now) {
      nextStopIdx = i;
      break;
    }
  }

  let currentStopIdx: number;
  if (nextStopIdx === null) {
    currentStopIdx = stops.length - 1;
  } else {
    currentStopIdx = nextStopIdx - 1;
  }

  const next = nextStopIdx !== null ? stops[nextStopIdx] : null;
  const nextLive = next ? live.find((l) => l.stopId === next.stopId) : undefined;
  let delaySec = 0;
  if (nextLive?.etaMs != null && nextLive.scheduledMs != null) {
    delaySec = Math.max(0, Math.round((nextLive.etaMs - nextLive.scheduledMs) / 1000));
  }

  return {
    stops,
    currentStopIdx,
    nextStopIdx,
    nextStopEtaMs: next?.etaMs ?? null,
    delaySec,
  };
}

/** @deprecated alias — prefer parseTimeline. Kept so call sites stay clear. */
export const timelineFromPredictions = parseTimeline;

export async function fetchTripTimeline(
  env: Env,
  tripId: string,
  previousStops: StopInfo[],
  now: number,
): Promise<TripTimeline | null> {
  let seed = previousStops;
  if (seed.length === 0) {
    try {
      const sched = await mbtaGet<ScheduleAttrs>(env, "/schedules", {
        "filter[trip]": tripId,
        include: "stop",
      });
      seed = parseScheduleStops(sched);
    } catch {
      // Predictions alone still work; indexes may shift until we have a seed.
      seed = [];
    }
  }

  const doc = await mbtaGet<PredictionAttrs>(env, "/predictions", {
    "filter[trip]": tripId,
    include: "stop,schedule",
    sort: "stop_sequence",
  });
  return parseTimeline(doc, seed, now);
}
