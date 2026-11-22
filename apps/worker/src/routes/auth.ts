/**
 * routes/auth.ts: email sign-in with a one-time code. An email address is an account.
 *
 * Routes (no auth):
 * - POST /api/auth/email/start   AuthStartReq { email } -> OkRes
 *   Issues a 6-digit code (10 min, single use) and emails it. 429 "too-soon" within 30 s of
 *   the last one; 429 "rate-limited" past the per-IP / per-email caps (lib/rateLimit.ts).
 *   The response is the same whether or not the email has an account.
 * - POST /api/auth/email/verify  AuthVerifyReq { email, code } -> AuthVerifyRes
 *   Existing account: { status: "signed-in", token, profile } (a new phone session).
 *   New email:        { status: "new-account", signupTicket }; the phone onboards and sends
 *                     the ticket with POST /api/users, which attaches the email.
 *   400 "wrong-code" | "expired" | "too-many-attempts" (5 wrong guesses kills the code).
 *
 * Protocol types: AuthStartReq, AuthVerifyReq, AuthVerifyRes, OkRes, ErrorRes.
 */
import { Hono } from "hono";
import { AuthStartReq, AuthVerifyReq } from "@questline/protocol";
import type { AppEnv } from "../env";
import {
  checkLoginCode,
  createSession,
  createSignupTicket,
  deleteLoginCode,
  getUser,
  getUserIdByEmail,
  issueLoginCode,
  loginCodeTooSoon,
} from "../db/queries";
import { sendLoginCode } from "../email/loginCode";
import type { AuthVerifyResT, OkRes } from "../lib/api";
import { readJson } from "../lib/http";
import { hit, limitByIp, tooMany } from "../lib/rateLimit";

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/auth/email/start", limitByIp("authStartIp"), async (c) => {
  const body = await readJson(c.req.raw, AuthStartReq);
  if (!body.ok) return c.json({ error: body.error, issues: body.issues }, 400);
  const { email } = body.data;
  const now = Date.now();
  const tooSoon = () => c.json({ error: "A code was just sent. Wait a few seconds and try again.", code: "too-soon" }, 429);
  // Cooldown first, so a double-tap doesn't use up the per-email cap.
  if (await loginCodeTooSoon(c.env.DB, email, now)) return tooSoon();
  if (!(await hit(c.env.DB, "authStartEmail", email, now))) return tooMany(c, "authStartEmail");
  const code = await issueLoginCode(c.env.DB, email, now);
  if (!code) return tooSoon();
  try {
    await sendLoginCode(c.env, email, code);
  } catch (e) {
    console.error("[auth] sending the sign-in code failed", e);
    await deleteLoginCode(c.env.DB, email);
    return c.json({ error: "We couldn't send the email. Try again in a moment.", code: "send-failed" }, 502);
  }
  const res: OkRes = { ok: true };
  return c.json(res);
});

authRoutes.post("/auth/email/verify", limitByIp("authVerifyIp"), async (c) => {
  const body = await readJson(c.req.raw, AuthVerifyReq);
  if (!body.ok) return c.json({ error: body.error, issues: body.issues }, 400);
  const { email, code } = body.data;
  const now = Date.now();

  const check = await checkLoginCode(c.env.DB, email, code, now);
  if (check !== "ok") {
    const message = {
      "wrong-code": "That code isn't right. Check the email and try again.",
      expired: "That code has expired. Send a new one.",
      "too-many-attempts": "Too many wrong tries. Send a new code.",
    }[check];
    return c.json({ error: message, code: check }, 400);
  }

  const userId = await getUserIdByEmail(c.env.DB, email);
  const user = userId ? await getUser(c.env.DB, userId) : null;
  let res: AuthVerifyResT;
  if (userId && user) {
    const token = await createSession(c.env.DB, userId, "phone", now);
    res = { status: "signed-in", userId, token, email, profile: user.profile };
  } else {
    res = { status: "new-account", email, signupTicket: await createSignupTicket(c.env.DB, email, now) };
  }
  return c.json(res);
});
