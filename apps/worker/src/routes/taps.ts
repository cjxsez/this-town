/**
 * routes/taps.ts: the NFC tap endpoint. phone-web's /k/:car?n=<nonce> landing page calls it.
 *
 * Route:
 * - POST /api/taps  (rider auth)  body TapReq { car, nonce?, destinationStop? } -> TapRes
 *
 * The worker decides what a tap means (architecture.md "Location: NFC tap"):
 * 1. Resolve car -> trip (mbta/vehicles.ts; DEMO_CAR_TRIPS in demo mode). No live trip ->
 *    { result: "error" }.
 * 2. Already checked in on this trip -> ask the room if it is a stamp tap (stampTap):
 *    "stamp-pending" / "stamp-awarded" / "error" (stale nonce). Null means not a stamp tap.
 * 3. Already on this trip, different car -> moveCar -> "moved-car".
 *    Same car again -> "checked-in" with the current state (idempotent re-tap).
 * 4. Checked in on another trip (changed trains) -> check out there ("moved-trip"), then
 *    treat as a fresh check-in.
 * 5. Fresh check-in: destinationStop from the body, else remembered from the last ride on
 *    this line. Missing or not an upcoming stop -> "need-destination" with the stop list;
 *    phone-web re-posts with destinationStop. Else room.checkIn -> "checked-in".
 *
 * Protocol types: TapReq, TapRes, RideState, Stamp.
 *
 * TODO:
 * - Make the remembered destination opt-in (phone-web confirms "Still going to X?").
 * - Static-sticker fallback (no nonce) is handled inside TrainRoom.stampTap.
 */
import { Hono } from "hono";
import { TapReq } from "@questline/protocol";
import type { AppEnv } from "../env";
import { requireRider } from "../auth";
import { activeCheckin, lastDestination } from "../db/queries";
import type { TapResT } from "../lib/api";
import { readJson } from "../lib/http";
import { resolveCarTrip } from "../mbta/vehicles";
import { roomFor } from "../rooms/stub";

export const tapsRoutes = new Hono<AppEnv>();

tapsRoutes.post("/taps", requireRider, async (c) => {
  const body = await readJson(c.req.raw, TapReq);
  if (!body.ok) return c.json({ error: body.error, issues: body.issues }, 400);
  const { car, nonce, destinationStop } = body.data;
  const userId = c.get("userId");

  const trip = await resolveCarTrip(c.env, car);
  if (!trip) {
    const res: TapResT = { result: "error", message: "This car isn't on a live trip right now." };
    return c.json(res);
  }
  const room = roomFor(c.env, trip.tripId);
  const active = await activeCheckin(c.env.DB, userId);

  if (active && active.tripId === trip.tripId) {
    const stamp = await room.stampTap({ userId, car, nonce });
    if (stamp) return c.json(stamp);
    if (active.car !== car) return c.json(await room.moveCar(userId, car));
    const snap = await room.snapshot(userId);
    const res: TapResT = { result: "checked-in", state: snap.state };
    return c.json(res);
  }

  if (active) await roomFor(c.env, active.tripId).checkOut(userId, "moved-trip");

  const stops = await room.upcomingStops(trip);
  const dest = destinationStop ?? (await lastDestination(c.env.DB, userId, trip.line));
  if (!dest || !stops.some((s) => s.id === dest)) {
    const res: TapResT = { result: "need-destination", line: trip.line, stops };
    return c.json(res);
  }
  return c.json(await room.checkIn({ userId, car, destinationStop: dest, trip }));
});
