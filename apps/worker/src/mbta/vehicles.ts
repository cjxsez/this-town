/**
 * mbta/vehicles.ts: car label -> the trip that car is running right now.
 *
 * Responsible for:
 * - `resolveCarTrip(env, car)`: the single entry point routes and the kiosk socket use to
 *   find which TrainRoom a car belongs to.
 *   1. DEMO_MODE and the car is in DEMO_CAR_TRIPS -> the scripted demo trip (mbta/demo.ts).
 *   2. Otherwise live: GET /vehicles?filter[route]=Orange,Red&include=trip and find the
 *      vehicle whose attributes.carriages[].label includes `car` (architecture.md "Car to
 *      trip mapping": Orange and new Red Line cars report carriages).
 * - carOrder: carriages[] in the order MBTA returns them, normalized so the front of the
 *   train (direction of travel) is first.
 * - `routeToLine()`: MBTA route id -> protocol Line.
 *
 * Protocol types: CarId, Line.
 *
 * TODO:
 * - resolveLiveCarTrip(): implement; cache the label -> TripInfo index for ~10 s.
 * - Confirm carriage order vs direction_id on a real train and flip if needed.
 * - A car keeps its label but changes trip at the terminal. Kiosks hold a socket to the old
 *   trip's room; TrainRoom closes kiosk sockets (code 4002) on trip end so they reconnect
 *   and land in the new room.
 */
import type { CarId, Line } from "@questline/protocol";
import { readConfig, type Env } from "../env";
import type { TripInfo } from "../rooms/state";
import { demoTripInfo } from "./demo";

export const ROUTES_WITH_CARRIAGES = ["Orange", "Red"] as const;

export interface VehicleAttrs {
  label: string;
  direction_id: 0 | 1;
  current_status: string;
  carriages?: { label: string; occupancy_status: string | null; occupancy_percentage: number | null }[];
}

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

export async function resolveCarTrip(env: Env, car: CarId): Promise<TripInfo | null> {
  const cfg = readConfig(env);
  if (cfg.demoMode) {
    const tripId = cfg.demoCarTrips[car];
    if (tripId) return demoTripInfo(tripId);
  }
  return resolveLiveCarTrip(env, car);
}

export async function resolveLiveCarTrip(env: Env, car: CarId): Promise<TripInfo | null> {
  throw new Error("TODO: mbtaGet('/vehicles', { 'filter[route]': 'Orange,Red', include: 'trip' }) and match carriages[].label");
}
