/**
 * lib/http.ts: request body parsing against protocol zod schemas.
 *
 * Responsible for:
 * - `readJson(req, schema)`: parse JSON, validate with a protocol schema (CreateUserReq,
 *   GlassesLinkReq, TapReq, GhostReq, ReportReq, ...), and return either typed data or a
 *   flat error list the route can send back as a 400.
 *
 * Protocol types: any request schema from packages/protocol/src/api.ts.
 *
 * TODO:
 * - Nothing required. If we add @hono/zod-validator later this can go away.
 */
import type { z } from "zod";

export interface BodyIssue {
  path: string;
  message: string;
}

export type ReadJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; issues: BodyIssue[] };

export async function readJson<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<ReadJsonResult<z.output<S>>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, error: "invalid json", issues: [] };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid body",
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  return { ok: true, data: parsed.data };
}
