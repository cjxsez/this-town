/**
 * link.ts (glasses-web): link these glasses to a rider account with a 4-digit code.
 *
 * Flow (architecture.md "Identity", decisions D10):
 *   1. POST /api/glasses/code              (no auth)  -> GlassesCodeRes { code, expiresAt }
 *   2. Show the code big on the lens. The rider types it on the phone, which calls
 *      POST /api/glasses/link (phone-web, not us).
 *   3. Poll GET /api/glasses/code/:code?secret=<pollSecret>  (no auth)  -> GlassesCodePollRes
 *      every POLL_MS until linked, then store the rider's token in localStorage.
 *   4. If the code expires (past expiresAt, or the poll 404s/410s), request a new one.
 *   5. On 429, back off exponentially (2 s doubling to 30 s) before the next poll/request.
 *   6. After linking, callers can GET /api/me to show "Linked as <firstName>" briefly.
 *
 * Expired/unknown codes: GET returns 410 (expired) or the poll helper treats 404 the same —
 * both mean "fetch a fresh code". POST /api/glasses/link returns 404 for unknown codes
 * (phone side).
 */
import type { GlassesCodePollRes, GlassesCodeRes, MeRes } from "@questline/protocol";

type CodeRes = (typeof GlassesCodeRes)["_output"];
type PollRes = (typeof GlassesCodePollRes)["_output"];
type Me = (typeof MeRes)["_output"];

const TOKEN_KEY = "questline.glasses.token";
const POLL_MS = 2000;
const BACKOFF_MIN_MS = 2_000;
const BACKOFF_MAX_MS = 30_000;

export function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage blocked: we stay linked for this page load only.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export async function requestCode(signal?: AbortSignal): Promise<CodeRes> {
  const res = await fetch("/api/glasses/code", { method: "POST", signal });
  if (res.status === 429) throw Object.assign(new Error("rate limited"), { status: 429 });
  if (!res.ok) throw new Error(`POST /api/glasses/code failed: ${res.status}`);
  return (await res.json()) as CodeRes;
}

/** Returns null when the code is unknown or expired, so the caller asks for a new one. */
export async function pollCode(code: string, pollSecret: string, signal?: AbortSignal): Promise<PollRes | null> {
  const url = `/api/glasses/code/${encodeURIComponent(code)}?secret=${encodeURIComponent(pollSecret)}`;
  const res = await fetch(url, { signal });
  if (res.status === 404 || res.status === 410) return null;
  if (res.status === 429) throw Object.assign(new Error("rate limited"), { status: 429 });
  if (!res.ok) throw new Error(`GET /api/glasses/code/${code} failed: ${res.status}`);
  return (await res.json()) as PollRes;
}

export async function fetchMe(token: string, signal?: AbortSignal): Promise<Me | null> {
  const res = await fetch("/api/me", {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok) return null;
  return (await res.json()) as Me;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function is429(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "status" in err && (err as { status: number }).status === 429);
}

export interface LinkingHandlers {
  onCode: (code: string, expiresAt: number) => void;
  /** Called after the token is saved; firstName may be null if /api/me failed. */
  onLinked: (token: string, firstName: string | null) => void;
  onError: (message: string) => void;
}

/** Runs the request-code / poll loop until linked. Returns a cancel function. */
export function startLinking(handlers: LinkingHandlers): () => void {
  const ctrl = new AbortController();
  const { signal } = ctrl;
  let backoffMs = BACKOFF_MIN_MS;

  (async () => {
    while (!signal.aborted) {
      try {
        const { code, pollSecret, expiresAt } = await requestCode(signal);
        backoffMs = BACKOFF_MIN_MS;
        handlers.onCode(code, expiresAt);

        while (!signal.aborted && Date.now() < expiresAt) {
          await sleep(POLL_MS, signal);
          try {
            const poll = await pollCode(code, pollSecret, signal);
            backoffMs = BACKOFF_MIN_MS;
            if (poll === null) break; // expired or unknown: get a new code
            if (poll.linked && poll.token) {
              saveToken(poll.token);
              const me = await fetchMe(poll.token, signal);
              handlers.onLinked(poll.token, me?.profile.firstName ?? null);
              return;
            }
          } catch (err) {
            if (signal.aborted) return;
            if (is429(err)) {
              await sleep(backoffMs, signal);
              backoffMs = Math.min(BACKOFF_MAX_MS, backoffMs * 2);
              continue;
            }
            throw err;
          }
        }
      } catch (err) {
        if (signal.aborted) return;
        if (is429(err)) {
          try {
            await sleep(backoffMs, signal);
          } catch {
            return;
          }
          backoffMs = Math.min(BACKOFF_MAX_MS, backoffMs * 2);
          continue;
        }
        handlers.onError(err instanceof Error ? err.message : String(err));
        try {
          await sleep(POLL_MS * 2, signal);
        } catch {
          return;
        }
      }
    }
  })();

  return () => ctrl.abort();
}
