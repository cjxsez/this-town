/**
 * link.ts (glasses-web): link these glasses to a rider account with a 4-digit code.
 *
 * Flow (architecture.md "Identity", decisions D10):
 *   1. POST /api/glasses/code              (no auth)  -> GlassesCodeRes { code, expiresAt }
 *   2. Show the code big on the lens. The rider types it on the phone, which calls
 *      POST /api/glasses/link (phone-web, not us).
 *   3. Poll GET /api/glasses/code/:code    (no auth)  -> GlassesCodePollRes { linked, token? }
 *      every POLL_MS until linked, then store the rider's token in localStorage.
 *   4. If the code expires (past expiresAt, or the poll 404s/410s), request a new one.
 *
 * The token is the same bearer token the phone uses; it authenticates /ws/rider?token=
 * and the GET /api/ride/state polling fallback.
 *
 * localStorage is available in the glasses browser, but every access is wrapped in
 * try/catch so a blocked storage just means "link again".
 *
 * TODO:
 * - Confirm with the worker what an expired/unknown code returns (404 vs 410 vs linked:false).
 * - Back off polling if the worker returns 429.
 * - Show "Linked as <firstName>" briefly after linking (needs GET /api/me with the new token).
 */
import type { GlassesCodePollRes, GlassesCodeRes } from "@questline/protocol";

// api.ts exports zod schemas but not their inferred types; derive them without importing zod.
type CodeRes = (typeof GlassesCodeRes)["_output"];
type PollRes = (typeof GlassesCodePollRes)["_output"];

const TOKEN_KEY = "questline.glasses.token";
const POLL_MS = 2000;

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
  if (!res.ok) throw new Error(`POST /api/glasses/code failed: ${res.status}`);
  return (await res.json()) as CodeRes;
}

/** Returns null when the code is unknown or expired, so the caller asks for a new one. */
export async function pollCode(code: string, signal?: AbortSignal): Promise<PollRes | null> {
  const res = await fetch(`/api/glasses/code/${encodeURIComponent(code)}`, { signal });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`GET /api/glasses/code/${code} failed: ${res.status}`);
  return (await res.json()) as PollRes;
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

export interface LinkingHandlers {
  onCode: (code: string, expiresAt: number) => void;
  onLinked: (token: string) => void;
  onError: (message: string) => void;
}

/** Runs the request-code / poll loop until linked. Returns a cancel function. */
export function startLinking(handlers: LinkingHandlers): () => void {
  const ctrl = new AbortController();
  const { signal } = ctrl;

  (async () => {
    while (!signal.aborted) {
      try {
        const { code, expiresAt } = await requestCode(signal);
        handlers.onCode(code, expiresAt);

        while (!signal.aborted && Date.now() < expiresAt) {
          await sleep(POLL_MS, signal);
          const poll = await pollCode(code, signal);
          if (poll === null) break; // expired or unknown: get a new code
          if (poll.linked && poll.token) {
            saveToken(poll.token);
            handlers.onLinked(poll.token);
            return;
          }
        }
      } catch (err) {
        if (signal.aborted) return;
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
