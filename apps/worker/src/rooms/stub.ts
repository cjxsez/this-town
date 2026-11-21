/**
 * rooms/stub.ts: how the worker isolate reaches a TrainRoom.
 *
 * Responsible for:
 * - `roomFor(env, tripId)`: one TrainRoom per MBTA trip_id (idFromName(tripId)). Returns an
 *   RPC stub; routes call its public methods (checkIn, moveCar, stampTap, ...).
 * - `forwardToRoom()`: forward a WebSocket upgrade (/ws/rider, /ws/kiosk/:car) to the room
 *   after the worker has authenticated it. Identity travels in internal headers, which are
 *   always stripped from the incoming request first so clients cannot spoof them.
 * - `INTERNAL_HEADERS`: the header names shared with TrainRoom.fetch().
 *
 * Protocol types: none (socket payloads are handled inside TrainRoom).
 *
 * TODO:
 * - Nothing required.
 */
import type { Env } from "../env";

export const INTERNAL_HEADERS = {
  user: "x-questline-user",
  kioskCar: "x-questline-kiosk-car",
  kioskRole: "x-questline-kiosk-role",
  /** JSON TripInfo, so a room can initialize itself when a kiosk connects first. */
  trip: "x-questline-trip",
} as const;

export function roomFor(env: Env, tripId: string) {
  return env.TRAIN_ROOM.get(env.TRAIN_ROOM.idFromName(tripId));
}

export function forwardToRoom(
  stub: { fetch(request: Request): Promise<Response> },
  req: Request,
  internal: Record<string, string>,
): Promise<Response> {
  const headers = new Headers(req.headers);
  for (const name of Object.values(INTERNAL_HEADERS)) headers.delete(name);
  for (const [name, value] of Object.entries(internal)) headers.set(name, value);
  return stub.fetch(new Request(req, { headers }));
}
