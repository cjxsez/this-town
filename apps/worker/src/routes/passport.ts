/**
 * routes/passport.ts: the rider's stamp collection.
 *
 * Route:
 * - GET /api/passport  (rider auth) -> PassportRes { stamps, peopleMet, byLine }
 *   stamps newest first; peopleMet = distinct people met (met_pairs rows for this user);
 *   byLine = stamp count per line.
 *
 * Protocol types: PassportRes, Stamp, Line.
 *
 * TODO:
 * - Paginate stamps if anyone ever gets more than ~200.
 */
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { requireRider } from "../auth";
import { passportFor, recentMatches } from "../db/queries";
import type { PassportResT } from "../lib/api";

export const passportRoutes = new Hono<AppEnv>();

passportRoutes.get("/passport", requireRider, async (c) => {
  const res: PassportResT = await passportFor(c.env.DB, c.get("userId"));
  return c.json(res);
});

passportRoutes.get("/matches/recent", requireRider, async (c) => {
  return c.json({ matches: await recentMatches(c.env.DB, c.get("userId")) });
});
