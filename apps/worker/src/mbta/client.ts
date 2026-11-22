/**
 * mbta/client.ts: thin fetch wrapper for the MBTA V3 API (JSON:API).
 *
 * Responsible for:
 * - Building https://api-v3.mbta.com URLs with query params (filter[...], include, fields).
 * - Sending the `x-api-key` header from env.MBTA_API_KEY (works without a key at a lower
 *   rate limit).
 * - Throwing `MbtaError` on non-2xx so callers can fall back to the last known timeline.
 * - On 429, parsing Retry-After into `retryAfterMs` for the TrainRoom poll backoff.
 * - Pure helpers for Retry-After parsing and exponential poll backoff (20 s → 2 min).
 *
 * Protocol types: none.
 *
 * Caching: vehicles.ts keeps a 10 s in-memory label map so rooms share one poll.
 */
import type { Env } from "../env";
import { MINUTE, SECOND } from "../lib/time";

export const MBTA_BASE = "https://api-v3.mbta.com";

/** First backoff after a failed live poll (matches ALARM_INTERVAL_MS). */
export const MBTA_BACKOFF_MIN_MS = 20 * SECOND;
/** Cap for consecutive MBTA failures. */
export const MBTA_BACKOFF_MAX_MS = 2 * MINUTE;

export interface JsonApiRef {
  id: string;
  type: string;
}

export interface JsonApiResource<A = Record<string, unknown>> {
  id: string;
  type: string;
  attributes: A;
  relationships?: Record<string, { data: JsonApiRef | JsonApiRef[] | null }>;
}

export interface JsonApiDoc<A = Record<string, unknown>> {
  data: JsonApiResource<A>[];
  included?: JsonApiResource[];
}

export class MbtaError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    /** Suggested wait before the next poll (from Retry-After on 429). */
    readonly retryAfterMs: number | null = null,
  ) {
    super(`MBTA ${path} -> ${status}`);
  }
}

/**
 * Parse a Retry-After header into a delay in ms.
 * Supports delay-seconds and HTTP-date forms. Returns null if missing or unusable.
 */
export function parseRetryAfterMs(header: string | null | undefined, nowMs: number = Date.now()): number | null {
  if (header == null || header.trim() === "") return null;
  const raw = header.trim();
  if (/^\d+$/.test(raw)) {
    const sec = Number(raw);
    if (!Number.isFinite(sec) || sec < 0) return null;
    return Math.min(MBTA_BACKOFF_MAX_MS, Math.round(sec * 1000));
  }
  const when = Date.parse(raw);
  if (!Number.isFinite(when)) return null;
  const wait = when - nowMs;
  if (wait <= 0) return 0;
  return Math.min(MBTA_BACKOFF_MAX_MS, wait);
}

/**
 * Next poll delay after a failed MBTA call: 20 s, then doubles, capped at 2 min.
 * Pass null (or 0) for the first failure after a success.
 */
export function nextMbtaBackoffMs(previousMs: number | null | undefined): number {
  if (previousMs == null || previousMs < MBTA_BACKOFF_MIN_MS) return MBTA_BACKOFF_MIN_MS;
  return Math.min(MBTA_BACKOFF_MAX_MS, previousMs * 2);
}

/** Prefer Retry-After when present; otherwise the exponential backoff ladder. */
export function mbtaPollDelayAfterError(
  err: { retryAfterMs?: number | null },
  previousBackoffMs: number | null | undefined,
): number {
  if (err.retryAfterMs != null && Number.isFinite(err.retryAfterMs)) {
    return Math.min(MBTA_BACKOFF_MAX_MS, Math.max(0, err.retryAfterMs));
  }
  return nextMbtaBackoffMs(previousBackoffMs);
}

export async function mbtaGet<A = Record<string, unknown>>(
  env: Env,
  path: string,
  params: Record<string, string> = {},
): Promise<JsonApiDoc<A>> {
  const url = new URL(path, MBTA_BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = { accept: "application/vnd.api+json" };
  if (env.MBTA_API_KEY) headers["x-api-key"] = env.MBTA_API_KEY;
  let res: Response;
  try {
    res = await fetch(url.toString(), { headers });
  } catch {
    // Network / DNS: surface as status 0 so TrainRoom can back off without ending the trip.
    throw new MbtaError(0, path, null);
  }
  if (!res.ok) {
    const retryAfterMs = res.status === 429 ? parseRetryAfterMs(res.headers.get("retry-after")) : null;
    throw new MbtaError(res.status, path, retryAfterMs);
  }
  return (await res.json()) as JsonApiDoc<A>;
}
