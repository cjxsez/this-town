/**
 * lib/rateLimit.ts: fixed-window rate limits for the routes anyone can call without a token
 * (email sign-in, creating riders, glasses codes). Counters live in D1 (migrations/0004),
 * so they hold across isolates and behave the same under `wrangler dev`.
 *
 * - `LIMITS`: every bucket in one place, so they are easy to tune before a demo (a venue
 *   Wi-Fi puts many people behind one IP, hence the generous per-IP numbers).
 * - `hit()`: count one request against a key; false once the window is used up.
 * - `limitByIp()`: Hono middleware that answers 429 { error, code: "rate-limited" } with a
 *   Retry-After header. The client IP is cf-connecting-ip ("local" under wrangler dev
 *   when it is missing). Requests carrying a valid X-Kiosk-Key skip it: that is our own
 *   tooling (pnpm seed, smoke), which makes many riders from one machine.
 */
import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import type { AppEnv } from "../env";
import { checkKioskKey } from "../auth";
import { MINUTE } from "./time";

export const LIMITS = {
  /** Sign-in emails requested from one IP. */
  authStartIp: { limit: 20, windowMs: 10 * MINUTE },
  /** Sign-in emails sent to one address (on top of the 30 s resend cooldown). */
  authStartEmail: { limit: 6, windowMs: 60 * MINUTE },
  /** Code guesses from one IP, across all emails (each code also dies after 5 wrong tries). */
  authVerifyIp: { limit: 40, windowMs: 10 * MINUTE },
  /** New riders (guest or account) from one IP. */
  createUserIp: { limit: 20, windowMs: 10 * MINUTE },
  /** 4-digit glasses codes issued to one IP. */
  glassesCodeIp: { limit: 30, windowMs: 10 * MINUTE },
  /** Two-player game rooms opened from one IP (`POST /game/rooms`). */
  gameCreateIp: { limit: 30, windowMs: 10 * MINUTE },
  /** Join / move-to-glasses attempts from one IP (`POST /game/rooms/:code/join|lens`). */
  gameJoinIp: { limit: 60, windowMs: 10 * MINUTE },
  /** Failed bearer-token lookups from one IP (valid tokens are never counted). */
  tokenFailIp: { limit: 60, windowMs: 10 * MINUTE },
} as const;

export type LimitName = keyof typeof LIMITS;

/** Counts one request against `bucket:subject`. Returns false when over the limit. */
export async function hit(db: D1Database, name: LimitName, subject: string, now = Date.now()): Promise<boolean> {
  const { limit, windowMs } = LIMITS[name];
  const key = `${name}:${subject}`;
  // SQLite evaluates every SET expression against the old row, so both CASEs see the old window.
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN window_start <= ?3 THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN window_start <= ?3 THEN ?2 ELSE window_start END
       RETURNING count`,
    )
    .bind(key, now, now - windowMs)
    .first<{ count: number }>();
  // Now and then, sweep counters whose window is long gone.
  if (Math.random() < 0.01) {
    await db.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(now - 24 * 60 * MINUTE).run();
  }
  return (row?.count ?? 0) <= limit;
}

export function clientIp(c: Context<AppEnv>): string {
  return c.req.header("cf-connecting-ip") ?? "local";
}

export function tooMany(c: Context<AppEnv>, name: LimitName) {
  c.header("Retry-After", String(Math.ceil(LIMITS[name].windowMs / 1000)));
  return c.json({ error: "Too many tries. Wait a few minutes and try again.", code: "rate-limited" }, 429);
}

/** Middleware: limit a route per client IP. */
export function limitByIp(name: LimitName) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const trusted = checkKioskKey(c.env, c.req.header("X-Kiosk-Key"));
    if (!trusted && !(await hit(c.env.DB, name, clientIp(c)))) return tooMany(c, name);
    await next();
  });
}
