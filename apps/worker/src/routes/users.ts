/**
 * routes/users.ts: onboarding and "who am I".
 *
 * Routes:
 * - POST /api/users  (no auth)   body CreateUserReq (= Profile)  -> 201 CreateUserRes
 *   Creates the user and a phone session; the phone stores the token in localStorage.
 * - GET  /api/me     (rider auth)                                -> MeRes
 *   Profile + whether a glasses session exists (phone-web shows "Link glasses" if not).
 *
 * Protocol types: CreateUserReq, CreateUserRes, MeRes, Profile.
 *
 * TODO:
 * - Rate-limit POST /api/users per IP (cf-connecting-ip).
 * - PUT /api/me to edit the profile, if phone-web needs it (not in the protocol yet).
 */
import { Hono } from "hono";
import { CreateUserReq } from "@questline/protocol";
import type { AppEnv } from "../env";
import { requireRider } from "../auth";
import { createSession, createUser, getUser, hasGlassesSession } from "../db/queries";
import type { CreateUserResT, MeResT } from "../lib/api";
import { readJson } from "../lib/http";

export const usersRoutes = new Hono<AppEnv>();

usersRoutes.post("/users", async (c) => {
  const body = await readJson(c.req.raw, CreateUserReq);
  if (!body.ok) return c.json({ error: body.error, issues: body.issues }, 400);
  const now = Date.now();
  const { userId } = await createUser(c.env.DB, body.data, now);
  const token = await createSession(c.env.DB, userId, "phone", now);
  const res: CreateUserResT = { userId, token };
  return c.json(res, 201);
});

usersRoutes.get("/me", requireRider, async (c) => {
  const userId = c.get("userId");
  const user = await getUser(c.env.DB, userId);
  if (!user) return c.json({ error: "not found" }, 404);
  const res: MeResT = { userId, profile: user.profile, glassesLinked: await hasGlassesSession(c.env.DB, userId) };
  return c.json(res);
});
