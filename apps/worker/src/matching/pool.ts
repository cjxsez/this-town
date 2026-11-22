/**
 * matching/pool.ts: hard filters. Who can be matched at all, and which pairs are allowed.
 *
 * Responsible for (architecture.md "Matching", steps 1 and 2):
 * - Pool: riders checked in to this trip who are not ghost, not in a notNow cooldown, not
 *   already paired, past their post-mission "next segment" wait, and still riding at least
 *   one more stop.
 * - Gate (per pair): shared interest tags >= MIN_SHARED_TAGS, not met in the last 7 days,
 *   not blocked in either direction, not declined ("Not now") earlier on this trip.
 *
 * Inputs come from RoomState; met/blocked lists were loaded from D1 at check-in.
 *
 * Protocol types: InterestTag.
 *
 * DEMO_MODE: TrainRoom passes `ignoreMetRecently: config.demoMode` so teammates can
 * rehearse without the 7-day met gate. One remaining stop is enough to enter the pool;
 * the mission selector waits for a segment that fits.
 */
import type { InterestTag } from "@questline/protocol";
import { pairKey } from "../lib/ids";
import type { RoomRider, RoomState } from "../rooms/state";

export interface GateOptions {
  minSharedTags: number;
  ignoreMetRecently: boolean;
}

/** Index of a stop by id (riders' boarded/destination stops are stored as ids). */
export function stopIndex(state: RoomState, stopId: string): number {
  return state.stops.findIndex((s) => s.stopId === stopId);
}

/** Segments left before this rider's destination (1 = getting off at the next stop). */
export function remainingSegments(rider: RoomRider, state: RoomState): number {
  const dest = stopIndex(state, rider.destinationStop);
  if (dest < 0) return 0;
  return dest - state.currentStopIdx;
}

/** `ignoreStops` (GAMES_ONLY): where a rider gets off, and the next-segment wait, don't count. */
export function inPool(rider: RoomRider, state: RoomState, now: number, ignoreStops = false): boolean {
  if (rider.ghost) return false;
  if (rider.pairId !== null) return false;
  if (rider.notNowUntil > now) return false;
  if (ignoreStops) return true;
  if (state.nextStopIdx === null || state.nextStopIdx < rider.eligibleFromStopIdx) return false;
  return remainingSegments(rider, state) >= 1;
}

export function buildPool(state: RoomState, now: number, ignoreStops = false): RoomRider[] {
  return Object.values(state.riders).filter((r) => inPool(r, state, now, ignoreStops));
}

export function sharedTags(a: RoomRider, b: RoomRider): InterestTag[] {
  const theirs = new Set(b.profile.interests);
  return a.profile.interests.filter((t) => theirs.has(t));
}

export function passesGate(a: RoomRider, b: RoomRider, state: RoomState, opts: GateOptions): boolean {
  if (a.userId === b.userId) return false;
  if (sharedTags(a, b).length < opts.minSharedTags) return false;
  if (a.blocked.includes(b.userId) || b.blocked.includes(a.userId)) return false;
  if (!opts.ignoreMetRecently && (a.metRecently.includes(b.userId) || b.metRecently.includes(a.userId))) {
    return false;
  }
  if (state.declinedPairs.includes(pairKey(a.userId, b.userId))) return false;
  return true;
}
