/**
 * Glasses HUD rider-facing copy that depends on worker gamesOnly.
 * Mission-mode strings match the previous hardcoded lines.
 */

/** Idle while looking for a match. */
export function idleLooking(gamesOnly: boolean): string {
  return gamesOnly ? "Looking for someone to play with…" : "Looking for your match…";
}

/** Stamp body under the station name. */
export function stampWithLine(line: string, partnerFirstName: string, gamesOnly: boolean): string {
  if (gamesOnly) {
    return `Played the three games with ${partnerFirstName}`;
  }
  return `${line} Line with ${partnerFirstName}`;
}
