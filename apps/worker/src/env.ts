/**
 * env.ts: the Worker's bindings and config.
 *
 * Responsible for:
 * - `Env`: every binding declared in wrangler.toml (ASSETS, DB, TRAIN_ROOM, EMAIL), every [vars]
 *   entry, and the secrets from .dev.vars / `wrangler secret put`.
 * - `AppEnv`: the Hono generic (Bindings + per-request Variables such as the authed userId).
 * - `readConfig()`: parses the string [vars] into typed numbers/booleans once per use.
 *
 * Protocol types: none directly (CarId is used for the demo car map).
 *
 * TODO:
 * - Keep `Env` in sync with wrangler.toml whenever a binding or var is added.
 * - Consider `wrangler types` to generate this instead once the config settles.
 */
import type { CarId } from "@questline/protocol";
import type { TrainRoom } from "./rooms/TrainRoom";

export interface Env {
  // ---- bindings ----
  ASSETS: Fetcher;
  DB: D1Database;
  TRAIN_ROOM: DurableObjectNamespace<TrainRoom>;
  /** Cloudflare Email Sending (`[[send_email]]`). Simulated under `wrangler dev`. */
  EMAIL?: SendEmail;

  // ---- [vars] (always strings) ----
  PUBLIC_ORIGIN: string;
  MIN_SHARED_TAGS: string;
  LATE_BONUS_MIN_DELAY_S: string;
  NOT_NOW_COOLDOWN_S: string;
  DEMO_MODE: string;
  /** JSON object: car label -> trip id, e.g. {"1412":"demo-trip-1"} */
  DEMO_CAR_TRIPS: string;
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
  demoCarTrips: Record<CarId, string>;
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
    demoCarTrips: parseCarTrips(env.DEMO_CAR_TRIPS),
  };
}
