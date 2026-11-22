/**
 * api.ts: typed fetch wrapper for the worker's REST API (/api/*).
 *
 * Responsible for:
 * - Same-origin relative fetches (Vite proxies /api to :8787 in dev).
 * - Adding `Authorization: Bearer <token>` from auth.ts (except POST /api/users).
 * - Parsing JSON responses with the @questline/protocol zod schemas so contract drift fails
 *   loudly at the edge instead of deep in a component.
 * - Throwing ApiError (status + parsed body) on non-2xx, and ApiError status 0 (code
 *   "timeout" or "offline") when the request never got an answer.
 *
 * Routes used:
 * - POST /api/auth/email/start   AuthStartReq -> OkRes                  (no auth)
 * - POST /api/auth/email/verify  AuthVerifyReq -> AuthVerifyRes         (no auth)
 * - POST /api/users          CreateUserReq (= Profile + signupTicket?) -> CreateUserRes   (no auth)
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
 * - On a 401 to a request that carried a token, auth.tokenRejected() so the app resets.
 */
import {
  AuthVerifyRes,
  ErrorRes,
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
import { getToken, tokenRejected } from "./auth";

/** Anything with a zod-style parse(). Lets us infer types without importing zod here. */
type Schema<T> = { parse: (data: unknown) => T };
type Infer<S extends Schema<unknown>> = ReturnType<S["parse"]>;

// protocol/api.ts exports schemas only, so derive the TS types here.
export type CreateUserResult = Infer<typeof CreateUserRes>;
export type AuthVerifyResult = Infer<typeof AuthVerifyRes>;
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
  /** The worker's machine reason (ErrorRes.code), e.g. "too-soon", "rate-limited". */
  readonly code: string | undefined;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    const parsed = ErrorRes.safeParse(body);
    this.code = parsed.success ? parsed.data.code : undefined;
  }
}

/** How long a request may hang before it fails with ApiError status 0, code "timeout". */
const TIMEOUT_MS = 8_000;
const RETRY_DELAY_MS = 600;

interface RequestOpts<T> {
  body?: unknown;
  schema?: Schema<T>;
  auth?: boolean;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Reads are safe to repeat, so a GET that timed out, lost the network or hit a 5xx gets one
 * more try after a short pause. Writes are never retried (a tap must not count twice).
 */
async function request<T = void>(method: Method, path: string, opts: RequestOpts<T> = {}): Promise<T> {
  try {
    return await requestOnce(method, path, opts);
  } catch (e) {
    const transient = e instanceof ApiError && (e.status === 0 || e.status >= 500);
    if (method !== "GET" || !transient) throw e;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return requestOnce(method, path, opts);
  }
}

async function requestOnce<T>(method: Method, path: string, { body, schema, auth = true }: RequestOpts<T>): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  // Train Wi-Fi and tunnels drop requests without failing them; give up after TIMEOUT_MS.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: abort.signal,
    });
  } catch (e) {
    const timedOut = abort.signal.aborted;
    throw new ApiError(0, timedOut ? "No signal. Try again in a moment." : "Can't reach In This Town. Check your connection.", {
      error: timedOut ? "timeout" : "network",
      code: timedOut ? "timeout" : "offline",
    });
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json: unknown = undefined;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }

  // A token the worker no longer knows (database reset, data deleted elsewhere): start over.
  if (res.status === 401 && auth && getToken()) tokenRejected();

  if (!res.ok) {
    // Every worker error is an ErrorRes; anything else (a proxy's HTML page) gets a generic line.
    const parsed = ErrorRes.safeParse(json);
    throw new ApiError(res.status, parsed.success ? parsed.data.error : `${method} ${path} failed (${res.status})`, json);
  }

  return schema ? schema.parse(json) : (undefined as T);
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

export const api = {
  /** Emails a 6-digit sign-in code. 429 (ApiError code "too-soon") if one just went out. */
  authStart: (email: string) => request("POST", "/api/auth/email/start", { body: { email }, auth: false }),

  /** "signed-in" with a token for an existing account, or "new-account" with a signup ticket. */
  authVerify: (email: string, code: string) =>
    request("POST", "/api/auth/email/verify", { body: { email, code }, schema: AuthVerifyRes, auth: false }),

  /** With a signupTicket the rider is an account with that email; without, a guest. */
  createUser: (profile: Profile, signupTicket?: string) =>
    request("POST", "/api/users", { body: { ...profile, signupTicket }, schema: CreateUserRes, auth: false }),

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
