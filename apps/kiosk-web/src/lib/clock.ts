/**
 * Server clock offset for countdown rendering on the kiosk screen.
 * offsetMs = serverNow - Date.now() from events that carry serverNow.
 */

let offsetMs = 0;

export function setServerNow(serverNow: number, clientNow: number = Date.now()): void {
  offsetMs = serverNow - clientNow;
}

export function serverNowMs(): number {
  return Date.now() + offsetMs;
}
