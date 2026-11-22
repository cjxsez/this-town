/**
 * Server clock offset for countdown rendering.
 * offsetMs = serverNow - Date.now() from events that carry serverNow.
 * Countdowns use Date.now() + offsetMs so lens, phone and kiosk agree.
 */

let offsetMs = 0;

export function setServerNow(serverNow: number, clientNow: number = Date.now()): void {
  offsetMs = serverNow - clientNow;
}

export function getOffsetMs(): number {
  return offsetMs;
}

/** Wall clock corrected toward the server. */
export function serverNowMs(): number {
  return Date.now() + offsetMs;
}
