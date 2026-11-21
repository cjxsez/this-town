/**
 * routes/ride.ts: Ride Mode controls and the glasses polling fallback.
 *
 * Routes (all rider auth):
 * - POST /api/ride/end    -> OkRes. Check out of the current trip ("ride-end"), Ride Mode off.
 *   Partner gets match.cleared "partner-left".
 * - PUT  /api/ride/ghost  body GhostReq { ghost } -> RideState. Ghost hides you from matching
 *   and kiosk counts; an active match is cleared with reason "ghost". Not riding: just saves
 *   the preference on users.ghost for the next check-in.
 * - POST /api/ride/not-now -> OkRes. REST twin of rider.notNow. The phone's "Not now" button
 *   uses it (there is no Neural Band, so the phone is the reliable path).
 * - POST /api/ride/arrived -> OkRes. REST twin of rider.arrived. Optional: tapping the
 *   meeting kiosk tag already counts as arriving.
 * - GET  /api/ride/state  -> RidePollRes { state, match, mission }. For glasses-web when
 *   WebSockets are not available in the glasses browser (decisions.md "Still open").
 *
 * Which room: the active check-in row in D1 (checkins.checked_out_at IS NULL) gives trip_id.
 *
 * Protocol types: GhostReq, RideState, MatchFoundEvent (payload), Mission.
 *
 * TODO:
 * - RidePollRes and the ghost/end response shapes are not in packages/protocol yet.
 * - Poll cadence guidance for glasses-web (2 s while matched, 5 s otherwise).
 */
import { Hono } from "hono";
import { GhostReq } from "@questline/protocol";
import type { AppEnv } from "../env";
import { requireRider } from "../auth";
import { activeCheckin, getUser, setUserGhost } from "../db/queries";
import type { OkRes, RidePollRes } from "../lib/api";
import { readJson } from "../lib/http";
import { roomFor } from "../rooms/stub";
import { offRideState } from "../rooms/state";

export const rideRoutes = new Hono<AppEnv>();

rideRoutes.post("/ride/end", requireRider, async (c) => {
  const userId = c.get("userId");
  const active = await activeCheckin(c.env.DB, userId);
  if (active) await roomFor(c.env, active.tripId).checkOut(userId, "ride-end");
  const res: OkRes = { ok: true };
  return c.json(res);
});

rideRoutes.put("/ride/ghost", requireRider, async (c) => {
  const body = await readJson(c.req.raw, GhostReq);
  if (!body.ok) return c.json({ error: body.error, issues: body.issues }, 400);
  const userId = c.get("userId");
  const active = await activeCheckin(c.env.DB, userId);
  if (active) return c.json(await roomFor(c.env, active.tripId).setGhost(userId, body.data.ghost));
  await setUserGhost(c.env.DB, userId, body.data.ghost);
  return c.json(offRideState(body.data.ghost));
});

rideRoutes.post("/ride/not-now", requireRider, async (c) => {
  const userId = c.get("userId");
  const active = await activeCheckin(c.env.DB, userId);
  if (!active) return c.json({ error: "not riding" }, 409);
  await roomFor(c.env, active.tripId).notNow(userId);
  const res: OkRes = { ok: true };
  return c.json(res);
});

rideRoutes.post("/ride/arrived", requireRider, async (c) => {
  const userId = c.get("userId");
  const active = await activeCheckin(c.env.DB, userId);
  if (!active) return c.json({ error: "not riding" }, 409);
  await roomFor(c.env, active.tripId).markArrived(userId, Date.now());
  const res: OkRes = { ok: true };
  return c.json(res);
});

rideRoutes.get("/ride/state", requireRider, async (c) => {
  const userId = c.get("userId");
  const active = await activeCheckin(c.env.DB, userId);
  if (active) return c.json(await roomFor(c.env, active.tripId).snapshot(userId));
  const user = await getUser(c.env.DB, userId);
  const res: RidePollRes = { state: offRideState(user?.ghost ?? false), match: null, mission: null, serverNow: Date.now() };
  return c.json(res);
});
