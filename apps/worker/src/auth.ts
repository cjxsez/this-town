/**
 * auth.ts: rider bearer tokens and the kiosk shared key.
 *
 * Responsible for:
 * - `bearerToken()`: pull the token out of `Authorization: Bearer <token>`.
 * - `requireRider`: Hono middleware for every rider REST route. Resolves the token to a
 *   userId through D1 sessions (phone and glasses tokens both work) and sets c.var.userId.
 *   Failed lookups are counted per IP (`LIMITS.tokenFailIp`); over the limit → 429.
 *   Valid tokens are never rate-limited. A valid `X-Kiosk-Key` skips the fail counter.
 * - `riderFromToken()`: same lookup for the `/ws/rider?token=` upgrade, where browsers
 *   cannot send headers.
 * - `checkKioskKey()` / `requireKiosk`: constant-time compare against env.KIOSK_KEY for
 *   `/ws/kiosk/:car?key=` and the /api/demo/* routes (header `X-Kiosk-Key` or `?key=`).
 * - `shouldTouchLastSeen()`: pure helper — bump `sessions.last_seen_at` at most once per
 *   10 minutes inside `userIdForToken`.
 *
 * Protocol: api.ts header comment ("Auth: Authorization: Bearer <token> except where noted"),
 * events.ts socket URLs (?token=, ?key=).
 */
import { createMiddleware } from "hono/factory";
import type { AppEnv, Env } from "./env";
import { userIdForToken } from "./db/queries";
import { clientIp, hit, tooMany } from "./lib/rateLimit";
import { LAST_SEEN_TOUCH_MS, shouldTouchLastSeen } from "./lib/time";

export { LAST_SEEN_TOUCH_MS, shouldTouchLastSeen };

export function bearerToken(header: string | undefined | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m?.[1] ?? null;
}

export async function riderFromToken(env: Env, token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  return userIdForToken(env.DB, token);
}

export const requireRider = createMiddleware<AppEnv>(async (c, next) => {
  const userId = await riderFromToken(c.env, bearerToken(c.req.header("Authorization")));
  if (userId) {
    c.set("userId", userId);
    await next();
    return;
  }
  // Count only failures. Tooling with a valid kiosk key skips the fail bucket.
  const trusted = checkKioskKey(c.env, c.req.header("X-Kiosk-Key"));
  if (!trusted && !(await hit(c.env.DB, "tokenFailIp", clientIp(c)))) {
    return tooMany(c, "tokenFailIp");
  }
  return c.json({ error: "unauthorized" }, 401);
});

export function checkKioskKey(env: Env, provided: string | undefined | null): boolean {
  if (!provided || !env.KIOSK_KEY) return false;
  const enc = new TextEncoder();
  const a = enc.encode(provided);
  const b = enc.encode(env.KIOSK_KEY);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

export const requireKiosk = createMiddleware<AppEnv>(async (c, next) => {
  const key = c.req.header("X-Kiosk-Key") ?? c.req.query("key");
  if (!checkKioskKey(c.env, key)) return c.json({ error: "unauthorized" }, 401);
  await next();
});
