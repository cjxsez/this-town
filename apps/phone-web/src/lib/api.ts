/**
 * api.ts: typed fetch wrapper for the worker's REST API (/api/*).
 *
 * Responsible for:
 * - Same-origin relative fetches (Vite proxies /api to :8787 in dev).
 * - Adding `Authorization: Bearer <token>` from auth.ts (except POST /api/users).
 * - Parsing JSON responses with the @questline/protocol zod schemas so contract drift fails
 *   loudly at the edge instead of deep in a component.
 * - Throwing ApiError (status + parsed body) on non-2xx.
 *
 * Routes used:
 * - POST /api/users          CreateUserReq (= Profile) -> CreateUserRes   (no auth)
 * - GET  /api/me             -> MeRes
 * - POST /api/glasses/link   GlassesLinkReq -> GlassesLinkRes
 * - POST /api/taps           TapReq -> TapRes
 * - POST /api/ride/end       -> (no body defined in protocol)
 * - PUT  /api/ride/ghost     GhostReq -> (no body defined in protocol)
 * - GET  /api/ride/state     -> RideStateRes (= RideSnapshot)
 * - POST /api/ride/not-now   REST twin of rider.notNow
 * - POST /api/ride/arrived   REST twin of rider.arrived
 * - GET  /api/passport       -> PassportRes
 * - POST /api/report         ReportReq -> (no body defined in protocol)
 *
 * TODO:
 * - Agree on a shared error body shape with the worker (protocol has none besides TapRes "error").
 * - Handle 401 globally: clear token and route to onboarding.
 * - Request timeout via AbortController (train Wi-Fi / cell in tunnels is flaky).
 */
import {
  CreateUserRes,
  GlassesLinkRes,
  MeRes,
  PassportRes,
  RecentMatchesRes,
  RideStateRes,
  TapRes,
  type Profile,
  type SocialBattery,
  type UpdateProfileReq,
} from "@questline/protocol";
import type { GhostReq, GlassesLinkReq, ReportReq, TapReq } from "@questline/protocol";
import { getToken } from "./auth";

/** Anything with a zod-style parse(). Lets us infer types without importing zod here. */
type Schema<T> = { parse: (data: unknown) => T };
type Infer<S extends Schema<unknown>> = ReturnType<S["parse"]>;

// protocol/api.ts exports schemas only, so derive the TS types here.
export type CreateUserResult = Infer<typeof CreateUserRes>;
export type Me = Infer<typeof MeRes>;
export type TapBody = Infer<typeof TapReq>;
export type TapResult = Infer<typeof TapRes>;
export type Passport = Infer<typeof PassportRes>;
export type ReportBody = Infer<typeof ReportReq>;
type GhostBody = Infer<typeof GhostReq>;
type GlassesLinkBody = Infer<typeof GlassesLinkReq>;

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

interface RequestOpts<T> {
  body?: unknown;
  schema?: Schema<T>;
  auth?: boolean;
}

async function request<T = void>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  { body, schema, auth = true }: RequestOpts<T> = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let json: unknown = undefined;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }

  if (!res.ok) {
    const message =
      typeof json === "object" && json !== null && "message" in json && typeof json.message === "string"
        ? json.message
        : typeof json === "object" && json !== null && "error" in json && typeof json.error === "string"
          ? json.error
          : `${method} ${path} failed (${res.status})`;
    throw new ApiError(res.status, message, json);
  }

  return schema ? schema.parse(json) : (undefined as T);
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

export const api = {
  createUser: (profile: Profile) =>
    request("POST", "/api/users", { body: profile, schema: CreateUserRes, auth: false }),

  getMe: () => request("GET", "/api/me", { schema: MeRes }),

  updateMe: (patch: UpdateProfileReq) => request("PATCH", "/api/me", { body: patch, schema: MeRes }),

  deleteMe: () => request("DELETE", "/api/me"),

  setMood: (mood: SocialBattery) => request("POST", "/api/ride/mood", { body: { mood } }),

  getRecentMatches: () => request("GET", "/api/matches/recent", { schema: RecentMatchesRes }),

  linkGlasses: (code: string) => {
    const body: GlassesLinkBody = { code };
    return request("POST", "/api/glasses/link", { body, schema: GlassesLinkRes });
  },

  /** The worker may answer a failed tap with a 4xx carrying a TapRes "error"; normalize that. */
  tap: async (body: TapBody): Promise<TapResult> => {
    try {
      return await request("POST", "/api/taps", { body, schema: TapRes });
    } catch (e) {
      if (e instanceof ApiError) {
        const parsed = TapRes.safeParse(e.body);
        if (parsed.success) return parsed.data;
      }
      throw e;
    }
  },

  getRideState: () => request("GET", "/api/ride/state", { schema: RideStateRes }),

  notNow: () => request("POST", "/api/ride/not-now"),

  arrived: () => request("POST", "/api/ride/arrived"),

  endRide: () => request("POST", "/api/ride/end"),

  setGhost: (ghost: boolean) => {
    const body: GhostBody = { ghost };
    return request("PUT", "/api/ride/ghost", { body });
  },

  getPassport: () => request("GET", "/api/passport", { schema: PassportRes }),

  report: (body: ReportBody) => request("POST", "/api/report", { body }),
};
