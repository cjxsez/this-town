/**
 * auth.ts: the rider's bearer token.
 *
 * Responsible for:
 * - Storing the token returned by POST /api/users in localStorage.
 * - Every storage access is wrapped in try/catch (private mode, blocked storage). If storage
 *   fails we keep the token in memory so the current tab still works.
 * - Building the onboarding redirect used when an un-onboarded rider lands on a screen
 *   (most importantly the NFC landing /k/:car), and validating the ?next= return path.
 *
 * Uses: no API routes directly. api.ts reads the token for `Authorization: Bearer`,
 * socket.ts reads it for /ws/rider?token=.
 *
 * TODO:
 * - Clear the token on a 401 from GET /api/me (stale token after a DB reset).
 * - "Sign out" / "delete my profile" entry point (needs a worker route, see README gaps).
 */

const TOKEN_KEY = "questline.token";
const TICKET_KEY = "questline.signupTicket";

let memoryToken: string | null = null;

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

export function setToken(token: string): void {
  memoryToken = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage blocked: memoryToken keeps this tab working.
  }
}

export function clearToken(): void {
  memoryToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * The signup ticket from verifying a NEW email (POST /api/auth/email/verify). Kept until
 * onboarding finishes and POST /api/users redeems it; valid 30 minutes on the worker.
 */
export function getSignupTicket(): string | null {
  try {
    return localStorage.getItem(TICKET_KEY);
  } catch {
    return null;
  }
}

export function setSignupTicket(ticket: string | null): void {
  try {
    if (ticket) localStorage.setItem(TICKET_KEY, ticket);
    else localStorage.removeItem(TICKET_KEY);
  } catch {
    // Storage blocked: the rider is created as a guest instead.
  }
}

export function hasToken(): boolean {
  return getToken() !== null;
}

/** "/onboarding?next=/k/1412?n=abc" so onboarding can send the rider back where they tapped. */
export function onboardingPath(returnTo: string): string {
  return `/onboarding?next=${encodeURIComponent(returnTo)}`;
}

/** Only allow same-origin relative paths as a return target (no "//evil.com"). */
export function readReturnPath(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}
