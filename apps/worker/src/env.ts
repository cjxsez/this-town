/**
 * env.ts: the Worker's bindings and config.
 *
 * Responsible for:
 * - `Env`: every binding declared in wrangler.toml (ASSETS, DB, TRAIN_ROOM, GAME_ROOM, EMAIL), every [vars]
 *   entry, and the secrets from .dev.vars / `wrangler secret put`.
 * - `AppEnv`: the Hono generic (Bindings + per-request Variables such as the authed userId).
 * - `readConfig()`: parses the string [vars] into typed numbers/booleans once per use.
 *
 * Protocol types: none directly (CarId is used for the demo car map).
 *
 * Keep `Env` and `readConfig` in sync with wrangler.toml; `test/envDrift.test.ts` fails CI when a
 * var or binding is added without updating this file.
 */
import type { CarId } from "@questline/protocol";
import type { GameRoom } from "./rooms/GameRoom";
import type { TrainRoom } from "./rooms/TrainRoom";
import type { DemoLine } from "./mbta/demo";

export interface Env {
  // ---- bindings ----
  ASSETS: Fetcher;
  DB: D1Database;
  TRAIN_ROOM: DurableObjectNamespace<TrainRoom>;
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  /** Cloudflare Email Sending (`[[send_email]]`). Simulated under `wrangler dev`. */
  EMAIL?: SendEmail;
  /** R2 bucket `questline-media`: media kept out of git, such as the waiting song (routes/media.ts). */
  MEDIA?: R2Bucket;

  // ---- [vars] (always strings) ----
  PUBLIC_ORIGIN: string;
  MIN_SHARED_TAGS: string;
  LATE_BONUS_MIN_DELAY_S: string;
  NOT_NOW_COOLDOWN_S: string;
  DEMO_MODE: string;
  /** "true": a match leads to the two-player games only. No missions, and stops don't matter. */
  GAMES_ONLY: string;
  /** JSON object: car label -> trip id, e.g. {"1412":"demo-trip-1"} */
  DEMO_CAR_TRIPS: string;
  /** Which scripted trip the demo cars run: "Green-D" (stage demo, default) or "Green-B" (Comm Ave, for filming on the train). */
  DEMO_LINE?: string;
  /** From address for sign-in emails; its domain must be onboarded to Email Sending. */
  EMAIL_FROM: string;

  // ---- secrets ----
  ANTHROPIC_API_KEY: string;
  MBTA_API_KEY: string;
  KIOSK_KEY: string;
}

export interface AppVariables {
  /** Set by requireRider (src/auth.ts). */
  userId: string;
}

export type AppEnv = { Bindings: Env; Variables: AppVariables };

export interface Config {
  publicOrigin: string;
  minSharedTags: number;
  lateBonusMinDelaySec: number;
  notNowCooldownSec: number;
  demoMode: boolean;
  gamesOnly: boolean;
  demoCarTrips: Record<CarId, string>;
  emailFrom: string;
  demoLine: DemoLine;
}

function intVar(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseCarTrips(raw: string | undefined): Record<CarId, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<CarId, string> = {};
    for (const [car, trip] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof trip === "string") out[car] = trip;
    }
    return out;
  } catch {
    return {};
  }
}

export function readConfig(env: Env): Config {
  return {
    publicOrigin: env.PUBLIC_ORIGIN.replace(/\/+$/, ""),
    minSharedTags: intVar(env.MIN_SHARED_TAGS, 1),
    lateBonusMinDelaySec: intVar(env.LATE_BONUS_MIN_DELAY_S, 180),
    notNowCooldownSec: intVar(env.NOT_NOW_COOLDOWN_S, 600),
    demoMode: env.DEMO_MODE === "true",
    gamesOnly: env.GAMES_ONLY === "true",
    demoCarTrips: parseCarTrips(env.DEMO_CAR_TRIPS),
    emailFrom: env.EMAIL_FROM,
    demoLine: env.DEMO_LINE === "Green-B" ? "Green-B" : "Green-D",
  };
}
