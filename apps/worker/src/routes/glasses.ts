/**
 * routes/glasses.ts: linking the Meta Ray-Ban Display glasses to a rider (decision D10).
 *
 * Routes:
 * - POST /api/glasses/code        (no auth, glasses-web)  -> 201 GlassesCodeRes
 *   Issues a 4-digit code (expires in GLASSES_CODE_TTL_MS) that the lens displays.
 * - GET  /api/glasses/code/:code  (no auth, glasses poll) -> GlassesCodePollRes
 *   { linked: false } until the phone links it; then once { linked: true, token } with a
 *   fresh glasses session token. Later polls return { linked: false } (claimed).
 * - POST /api/glasses/link        (rider auth, phone-web) body GlassesLinkReq -> GlassesLinkRes
 *
 * Protocol types: GlassesCodeRes, GlassesCodePollRes, GlassesLinkReq, GlassesLinkRes.
 *
 * TODO:
 * - Security: anyone who polls the same 4-digit code during the window gets the token. The
 *   poll should require a secret only the glasses know (see README "Protocol gaps").
 *   Until then keep the TTL short and rate-limit polls per IP.
 */
import { Hono } from "hono";
import { GlassesLinkReq } from "@questline/protocol";
import type { AppEnv } from "../env";
import { requireRider } from "../auth";
import { createGlassesCode, linkGlassesCode, pollGlassesCode } from "../db/queries";
import type { GlassesCodePollResT, GlassesCodeResT, GlassesLinkResT } from "../lib/api";
import { readJson } from "../lib/http";
import { limitByIp } from "../lib/rateLimit";

export const glassesRoutes = new Hono<AppEnv>();

glassesRoutes.post("/glasses/code", limitByIp("glassesCodeIp"), async (c) => {
  const res: GlassesCodeResT = await createGlassesCode(c.env.DB, Date.now());
  return c.json(res, 201);
});

glassesRoutes.get("/glasses/code/:code", async (c) => {
  const code = c.req.param("code");
  if (!/^\d{4}$/.test(code)) return c.json({ error: "bad code" }, 400);
  const secret = c.req.query("secret") ?? "";
  const res: GlassesCodePollResT | null = await pollGlassesCode(c.env.DB, code, secret, Date.now());
  if (!res) return c.json({ error: "code expired, request a new one" }, 410);
  return c.json(res);
});

glassesRoutes.post("/glasses/link", requireRider, async (c) => {
  const body = await readJson(c.req.raw, GlassesLinkReq);
  if (!body.ok) return c.json({ error: body.error, issues: body.issues }, 400);
  const ok = await linkGlassesCode(c.env.DB, body.data.code, c.get("userId"), Date.now());
  if (!ok) return c.json({ error: "code expired or unknown" }, 404);
  const res: GlassesLinkResT = { ok: true };
  return c.json(res);
});
