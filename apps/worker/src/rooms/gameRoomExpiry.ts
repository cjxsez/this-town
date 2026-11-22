/**
 * Pure helpers for GameRoom storage TTL (see rooms/GameRoom.ts alarm).
 * Kept out of GameRoom.ts so node:test can import them without cloudflare:workers.
 */

/** Drop a room's Durable Object storage after this long with no activity. */
export const ROOM_STORAGE_TTL_MS = 6 * 60 * 60 * 1000;

/** True when a room's last activity is old enough that its storage should be deleted. */
export function roomStorageExpired(touchedAt: number, now: number, ttlMs: number = ROOM_STORAGE_TTL_MS): boolean {
  return now - touchedAt >= ttlMs;
}
