/**
 * nfc.ts: NFC tag nonces and tag URLs.
 *
 * Responsible for:
 * - `newNonce()`: a fresh, short, URL-safe nonce per mission. The Pi writes it to the
 *   dynamic tag (NfcWriteEvent), and a stamp only counts when both riders tap with it.
 *   Kept short so the URL fits an NTAG215 / NTAG I2C plus NDEF record comfortably.
 * - `tagUrl()`: `${PUBLIC_ORIGIN}/k/${car}?n=${nonce}` (or `/k/${car}` for the static
 *   sticker / idle tag). phone-web's NFC landing route reads `car` and `n` and calls
 *   POST /api/taps with { car, nonce }.
 * - `nonceMatches()`: compare a tapped nonce against the session's current nonce.
 *
 * Protocol types: CarId, NfcWriteEvent (url), TapReq (car, nonce).
 *
 * Between missions the Pi writes the plain `/k/<car>` URL (check-in only). TrainRoom
 * sends that on pair.cleared / mission end via resetTag().
 */
import type { CarId } from "@questline/protocol";
import { base64url, randomBytes } from "./lib/ids";

/** 9 random bytes -> 12 base64url chars. */
export function newNonce(): string {
  return base64url(randomBytes(9));
}

export function tagUrl(publicOrigin: string, car: CarId, nonce?: string | null): string {
  const base = `${publicOrigin.replace(/\/+$/, "")}/k/${encodeURIComponent(car)}`;
  return nonce ? `${base}?n=${encodeURIComponent(nonce)}` : base;
}

export function nonceMatches(expected: string | null, provided: string | undefined): boolean {
  if (!expected || !provided || expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}
