/**
 * lib/ids.ts: id, token and code generation.
 *
 * Responsible for:
 * - Prefixed random ids for D1 rows and room objects (usr_, chk_, mat_, ses_, stp_, rpt_).
 * - Bearer tokens (random, base64url) and their sha256 hash (only the hash is stored).
 * - 4-digit glasses link codes.
 * - `pairKey(a, b)`: the normalized key for a pair of users (sorted, "a:b"), used by
 *   matches.pair_key, mission_sessions.pair_key, the why cache and declined pairs.
 *
 * Protocol types: none.
 *
 * TODO:
 * - Nothing required. Swap to ULIDs if we want time-sortable ids.
 */

export type IdPrefix = "usr" | "chk" | "mat" | "ses" | "stp" | "rpt";

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

/** Bearer token handed to phone/glasses. 32 random bytes. */
export function newToken(): string {
  return base64url(randomBytes(32));
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Uniform 0000-9999 (rejection sampling to avoid modulo bias). */
export function fourDigitCode(): string {
  const buf = new Uint16Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    const v = buf[0] ?? 0;
    if (v < 60000) return String(v % 10000).padStart(4, "0");
  }
}

/** Sorted pair of user ids. */
export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function pairKey(a: string, b: string): string {
  const [x, y] = orderedPair(a, b);
  return `${x}:${y}`;
}
