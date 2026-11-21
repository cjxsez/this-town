/**
 * routes/demo.ts: presenter controls for the scripted demo trip (docs/demo-script.md).
 * Every route 404s unless DEMO_MODE = "true".
 *
 * Routes (kiosk key: header X-Kiosk-Key or ?key=):
 * - POST /api/demo/delay    body { seconds? } (default DEMO_DEFAULT_DELAY_SEC = 240)
 *   Scripted delay; once delaySec > LATE_BONUS_MIN_DELAY_S the late-bonus missions unlock
 *   (demo step 6).
 * - POST /api/demo/advance  jump to just before the next stop.
 * - POST /api/demo/reset    clear the demo room (check everyone out, restart the clock).
 *
 * Which room: the trip id in DEMO_CAR_TRIPS (first value), or body.tripId.
 *
 * Protocol types: none (demo-only, not part of the contract).
 *
 * TODO:
 * - DEMO_MODE reset should also clear met_pairs between the demo users so rehearsals
 *   do not trip the 7-day gate (pool.ts ignores it in demo mode, but passport counts grow).
 */
import { Hono } from "hono";
import { z } from "zod";
import { readConfig, type AppEnv } from "../env";
import { requireKiosk } from "../auth";
import type { OkRes } from "../lib/api";
import { readJson } from "../lib/http";
import { DEMO_DEFAULT_DELAY_SEC, DEMO_TRIP_ID } from "../mbta/demo";
import { roomFor } from "../rooms/stub";

const DelayReq = z.object({
  seconds: z.number().int().min(0).max(1800).default(DEMO_DEFAULT_DELAY_SEC),
  tripId: z.string().optional(),
});
const TripReq = z.object({ tripId: z.string().optional() });

export const demoRoutes = new Hono<AppEnv>();

demoRoutes.use("/demo/*", async (c, next) => {
  if (!readConfig(c.env).demoMode) return c.json({ error: "not found" }, 404);
  await next();
});
demoRoutes.use("/demo/*", requireKiosk);

function demoTripId(env: AppEnv["Bindings"], override?: string): string {
  return override ?? Object.values(readConfig(env).demoCarTrips)[0] ?? DEMO_TRIP_ID;
}

demoRoutes.post("/demo/delay", async (c) => {
  const body = await readJson(c.req.raw, DelayReq);
  if (!body.ok) return c.json({ error: body.error, issues: body.issues }, 400);
  await roomFor(c.env, demoTripId(c.env, body.data.tripId)).demoTriggerDelay(body.data.seconds);
  const res: OkRes = { ok: true };
  return c.json(res);
});

demoRoutes.post("/demo/advance", async (c) => {
  const body = await readJson(c.req.raw, TripReq);
  await roomFor(c.env, demoTripId(c.env, body.ok ? body.data.tripId : undefined)).demoAdvance();
  const res: OkRes = { ok: true };
  return c.json(res);
});

demoRoutes.post("/demo/reset", async (c) => {
  const body = await readJson(c.req.raw, TripReq);
  await roomFor(c.env, demoTripId(c.env, body.ok ? body.data.tripId : undefined)).demoReset();
  const res: OkRes = { ok: true };
  return c.json(res);
});
