/**
 * routes/report.ts: report (and optionally block) a match partner. Always one action away
 * (architecture.md "Safety and privacy").
 *
 * Route:
 * - POST /api/report  (rider auth) body ReportReq { matchId, reason, block } -> OkRes
 * - POST /api/unblock (rider auth) body UnblockReq { matchId } -> OkRes
 *   1. The match must include the caller (getMatchForUser), else 404.
 *   2. insertReport; if block, insertBlock(caller -> partner). Matching treats blocks in
 *      either direction as a hard filter; rooms load them at check-in.
 *   3. Tell the trip's room (applyReport): it ends a live pair, never re-pairs the two on
 *      this trip, and applies a block to riders already on board. The reported rider only
 *      hears that their partner left.
 *
 * Protocol types: ReportReq, UnblockReq.
 */
import { Hono } from "hono";
import { ReportReq, UnblockReq } from "@questline/protocol";
import type { AppEnv } from "../env";
import { requireRider } from "../auth";
import { deleteBlock, getMatchForUser, insertBlock, insertReport } from "../db/queries";
import type { OkResT as OkRes } from "../lib/api";
import { readJson } from "../lib/http";
import { newId } from "../lib/ids";
import { roomFor } from "../rooms/stub";

export const reportRoutes = new Hono<AppEnv>();

reportRoutes.post("/report", requireRider, async (c) => {
  const body = await readJson(c.req.raw, ReportReq);
  if (!body.ok) return c.json({ error: body.error, issues: body.issues }, 400);
  const userId = c.get("userId");
  const { matchId, reason, block } = body.data;

  const match = await getMatchForUser(c.env.DB, matchId, userId);
  if (!match) return c.json({ error: "match not found" }, 404);

  const now = Date.now();
  await insertReport(c.env.DB, {
    id: newId("rpt"),
    reporterId: userId,
    reportedUserId: match.otherUserId,
    matchId,
    reason,
    blocked: block,
    createdAt: now,
  });
  if (block) await insertBlock(c.env.DB, userId, match.otherUserId, now);
  // Even an ended match's room may still hold both riders (same train, next segment).
  await roomFor(c.env, match.tripId).applyReport(matchId, userId, match.otherUserId, block);

  const res: OkRes = { ok: true };
  return c.json(res);
});

/**
 * POST /api/unblock (rider auth) body UnblockReq { matchId } -> OkRes. Lifts the caller's own
 * block on that match's partner. A block the partner placed on the caller stays: matching
 * still keeps them apart. Takes effect for rooms at the next check-in.
 */
reportRoutes.post("/unblock", requireRider, async (c) => {
  const body = await readJson(c.req.raw, UnblockReq);
  if (!body.ok) return c.json({ error: body.error, issues: body.issues }, 400);
  const userId = c.get("userId");
  const match = await getMatchForUser(c.env.DB, body.data.matchId, userId);
  if (!match) return c.json({ error: "match not found" }, 404);
  await deleteBlock(c.env.DB, userId, match.otherUserId);
  const res: OkRes = { ok: true };
  return c.json(res);
});
