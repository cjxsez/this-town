/**
 * routes/users.ts: onboarding and "who am I".
 *
 * Routes:
 * - POST /api/users  (no auth)   body CreateUserReq (= Profile + optional signupTicket)
 *   -> 201 CreateUserRes. Creates the user and a phone session; the phone stores the token.
 *   With a signupTicket (from POST /api/auth/email/verify) the user gets that verified email,
 *   which makes it an account they can sign back in to. Without one it is a guest.
 *   400 "bad-ticket" (unknown, used or expired), 409 "email-taken", 429 "rate-limited" (per IP).
 * - GET  /api/me     (rider auth)                                -> MeRes
 *   Profile, email (null for guests), and whether a glasses session exists.
 * - PATCH /api/me    (rider auth)   UpdateProfileReq             -> MeRes
 * - DELETE /api/me   (rider auth)                                -> OkRes
 *   Checks out, signs out every device, scrubs the profile and frees the email.
 *
 * Protocol types: CreateUserReq, CreateUserRes, MeRes, UpdateProfileReq, Profile.
 *
 * TODO:
 * - Let a guest attach an email later (verify a code while signed in).
 */
import { Hono } from "hono";
import { CreateUserReq, Profile, UpdateProfileReq } from "@questline/protocol";
import type { AppEnv } from "../env";
import { requireRider } from "../auth";
import {
  activeCheckin,
  createSession,
  createUser,
  getUser,
  getUserEmail,
  getUserIdByEmail,
  hasGlassesSession,
  redeemSignupTicket,
  scrubUser,
  updateUser,
} from "../db/queries";
import { roomFor } from "../rooms/stub";
import type { CreateUserResT, MeResT } from "../lib/api";
import { readJson } from "../lib/http";
import { limitByIp } from "../lib/rateLimit";

export const usersRoutes = new Hono<AppEnv>();

usersRoutes.post("/users", limitByIp("createUserIp"), async (c) => {
  const body = await readJson(c.req.raw, CreateUserReq);
  if (!body.ok) return c.json({ error: body.error, issues: body.issues }, 400);
  const { signupTicket, ...profile } = body.data;
  const now = Date.now();

  let email: string | null = null;
  if (signupTicket) {
    email = await redeemSignupTicket(c.env.DB, signupTicket, now);
    if (!email) return c.json({ error: "Your sign-in expired. Sign in with your email again.", code: "bad-ticket" }, 400);
    if (await getUserIdByEmail(c.env.DB, email)) {
      return c.json({ error: "That email already has an account. Sign in instead.", code: "email-taken" }, 409);
    }
  }

  const { userId } = await createUser(c.env.DB, profile, now, email);
  const token = await createSession(c.env.DB, userId, "phone", now);
  const res: CreateUserResT = { userId, token };
  return c.json(res, 201);
});

usersRoutes.get("/me", requireRider, async (c) => {
  const userId = c.get("userId");
  const user = await getUser(c.env.DB, userId);
  if (!user) return c.json({ error: "not found" }, 404);
  const res: MeResT = {
    userId,
    profile: user.profile,
    glassesLinked: await hasGlassesSession(c.env.DB, userId),
    email: await getUserEmail(c.env.DB, userId),
  };
  return c.json(res);
});

usersRoutes.patch("/me", requireRider, async (c) => {
  const body = await readJson(c.req.raw, UpdateProfileReq);
  if (!body.ok) return c.json({ error: body.error, issues: body.issues }, 400);
  const userId = c.get("userId");
  const user = await getUser(c.env.DB, userId);
  if (!user) return c.json({ error: "not found" }, 404);
  const next = Profile.safeParse({ ...user.profile, ...body.data });
  if (!next.success) return c.json({ error: "invalid profile", issues: next.error.issues }, 400);
  await updateUser(c.env.DB, userId, next.data);
  const active = await activeCheckin(c.env.DB, userId);
  if (active) await roomFor(c.env, active.tripId).updateRiderProfile(userId, next.data);
  const res: MeResT = {
    userId,
    profile: next.data,
    glassesLinked: await hasGlassesSession(c.env.DB, userId),
    email: await getUserEmail(c.env.DB, userId),
  };
  return c.json(res);
});

usersRoutes.delete("/me", requireRider, async (c) => {
  const userId = c.get("userId");
  const active = await activeCheckin(c.env.DB, userId);
  if (active) await roomFor(c.env, active.tripId).checkOut(userId, "ride-end");
  await scrubUser(c.env.DB, userId);
  return c.json({ ok: true as const });
});
