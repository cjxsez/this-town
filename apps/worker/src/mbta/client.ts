/**
 * mbta/client.ts: thin fetch wrapper for the MBTA V3 API (JSON:API).
 *
 * Responsible for:
 * - Building https://api-v3.mbta.com URLs with query params (filter[...], include, fields).
 * - Sending the `x-api-key` header from env.MBTA_API_KEY (works without a key at a lower
 *   rate limit).
 * - Throwing `MbtaError` on non-2xx so callers can fall back to the last known timeline.
 * - JSON:API document types used by predictions.ts and vehicles.ts.
 *
 * Protocol types: none.
 *
 * TODO:
 * - Short edge caching for /vehicles (many rooms ask for the same route every 20 s):
 *   use caches.default keyed by URL with a ~10 s TTL.
 * - Respect 429 Retry-After.
 */
import type { Env } from "../env";

export const MBTA_BASE = "https://api-v3.mbta.com";

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
  ) {
    super(`MBTA ${path} -> ${status}`);
  }
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
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new MbtaError(res.status, path);
  return (await res.json()) as JsonApiDoc<A>;
}
