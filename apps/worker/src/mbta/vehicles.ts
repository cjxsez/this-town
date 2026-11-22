/**
 * mbta/vehicles.ts: car label -> the trip that car is running right now.
 *
 * Responsible for:
 * - `resolveCarTrip(env, car)`: the single entry point routes and the kiosk socket use to
 *   find which TrainRoom a car belongs to.
 *   1. DEMO_MODE and the car is in DEMO_CAR_TRIPS -> the scripted demo trip (mbta/demo.ts).
 *   2. Otherwise live: GET /vehicles?filter[route]=Orange,Red&include=trip and find the
 *      vehicle whose attributes.carriages[].label equals `car` (architecture.md "Car to
 *      trip mapping": Orange and new Red Line cars report carriages).
 * - carOrder: carriage labels with the front of the train (direction of travel) first.
 * - `routeToLine()`: MBTA route id -> protocol Line.
 * - `parseVehicles(doc)`: pure JSON:API -> label map (unit-tested against __fixtures__).
 *
 * Protocol types: CarId, Line.
 *
 * A car keeps its label but changes trip at the terminal. Kiosks hold a socket to the old
 * trip's room; TrainRoom closes kiosk sockets (code 4002) on trip end so they reconnect
 * and land in the new room.
 */
import type { CarId, Line } from "@questline/protocol";
import { readConfig, type Env } from "../env";
import type { TripInfo } from "../rooms/state";
import { mbtaGet, type JsonApiDoc, type JsonApiResource } from "./client";
import { demoTripInfo } from "./demo";

export const ROUTES_WITH_CARRIAGES = ["Orange", "Red"] as const;

const CACHE_TTL_MS = 10_000;

export interface VehicleAttrs {
  label: string;
  direction_id: 0 | 1;
  current_status: string;
  carriages?: { label: string; occupancy_status: string | null; occupancy_percentage: number | null }[];
}

interface CacheEntry {
  at: number;
  byCar: Map<string, TripInfo>;
}

let vehicleCache: CacheEntry | null = null;

export function routeToLine(routeId: string): Line | null {
  switch (routeId) {
    case "Red":
    case "Orange":
    case "Blue":
    case "Green-B":
    case "Green-C":
    case "Green-D":
    case "Green-E":
      return routeId as Line;
    default:
      return null;
  }
}

/**
 * Pure: map a /vehicles JSON:API document to car-label -> TripInfo.
 *
 * carOrder assumption (unverified on a real train): MBTA returns `carriages[]` already
 * ordered with the front of the train — in the direction of travel — first. We keep that
 * order and do not flip based on `direction_id`. If a field check shows the reverse, flip
 * here when `direction_id === 0` (or whichever way is wrong).
 */
export function parseVehicles(doc: JsonApiDoc<VehicleAttrs>): Map<string, TripInfo> {
  const included = new Map<string, JsonApiResource>();
  for (const res of doc.included ?? []) included.set(`${res.type}:${res.id}`, res);

  const byCar = new Map<string, TripInfo>();
  for (const vehicle of doc.data) {
    const tripRef = vehicle.relationships?.trip?.data;
    if (!tripRef || Array.isArray(tripRef)) continue;

    const routeRef = vehicle.relationships?.route?.data;
    let routeId = !Array.isArray(routeRef) && routeRef ? routeRef.id : null;
    if (!routeId) {
      const trip = included.get(`trip:${tripRef.id}`);
      const tr = trip?.relationships?.route?.data;
      routeId = !Array.isArray(tr) && tr ? tr.id : null;
    }
    if (!routeId) continue;
    const line = routeToLine(routeId);
    if (!line) continue;

    const carriages = vehicle.attributes.carriages ?? [];
    const carOrder = carriages
      .map((c) => (c.label ?? "").trim())
      .filter((label): label is CarId => label.length > 0);
    if (carOrder.length === 0) continue;

    const info: TripInfo = {
      tripId: tripRef.id,
      line,
      routeId,
      directionId: vehicle.attributes.direction_id,
      carOrder,
      demo: false,
    };
    for (const label of carOrder) byCar.set(label, info);
  }
  return byCar;
}

export async function resolveCarTrip(env: Env, car: CarId): Promise<TripInfo | null> {
  const cfg = readConfig(env);
  if (cfg.demoMode) {
    const tripId = cfg.demoCarTrips[car];
    if (tripId) return demoTripInfo(tripId, cfg.demoLine);
  }
  return resolveLiveCarTrip(env, car);
}

export async function resolveLiveCarTrip(env: Env, car: CarId): Promise<TripInfo | null> {
  const now = Date.now();
  if (!vehicleCache || now - vehicleCache.at >= CACHE_TTL_MS) {
    const doc = await mbtaGet<VehicleAttrs>(env, "/vehicles", {
      "filter[route]": ROUTES_WITH_CARRIAGES.join(","),
      include: "trip",
    });
    vehicleCache = { at: now, byCar: parseVehicles(doc) };
  }
  return vehicleCache.byCar.get(car) ?? null;
}

/** Test helper: drop the in-memory vehicles cache. */
export function clearVehicleCache(): void {
  vehicleCache = null;
}
