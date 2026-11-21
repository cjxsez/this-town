/**
 * matching/score.ts: ranking of allowed pairs.
 *
 * Responsible for (architecture.md "Matching", step 3, decision D6):
 * - Closeness first: car distance (0 same car, 1 adjacent, ...). Lower is better.
 * - Ties broken by interest score (shared tags + "ask me about" similarity), then social
 *   battery match, then novelty. Higher is better for all three.
 * - `comparePairScores()`: the sort order greedy pairing uses.
 *
 * Protocol types: CarId, SocialBattery.
 *
 * TODO:
 * - novelty(): needs lifetime met counts (met_pairs.times_met), not just the 7-day list.
 *   Load into RoomRider at check-in, then score never-met pairs highest.
 * - askMeAbout similarity is a crude token overlap. Good enough for a hackathon.
 * - Unknown cars (not in carOrder) get a large distance so known-adjacent pairs win.
 */
import type { CarId, SocialBattery } from "@questline/protocol";
import type { RiderProfileLite, RoomRider, RoomState } from "../rooms/state";
import { sharedTags } from "./pool";

export interface PairScore {
  carDistance: number;
  interest: number;
  battery: number;
  novelty: number;
}

const UNKNOWN_CAR_DISTANCE = 99;
const BATTERY_ORDER: readonly SocialBattery[] = ["nod", "quick-chat", "lets-talk"];

export function carDistance(carOrder: readonly CarId[], a: CarId, b: CarId): number {
  if (a === b) return 0;
  const i = carOrder.indexOf(a);
  const j = carOrder.indexOf(b);
  if (i < 0 || j < 0) return UNKNOWN_CAR_DISTANCE;
  return Math.abs(i - j);
}

function words(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2),
  );
}

export function askMeAboutSimilarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let both = 0;
  for (const w of wa) if (wb.has(w)) both++;
  return both / (wa.size + wb.size - both);
}

export function interestScore(a: RiderProfileLite, b: RiderProfileLite, shared: number): number {
  return shared + askMeAboutSimilarity(a.askMeAbout, b.askMeAbout);
}

/** 1 same battery, 0.5 one step apart, 0 opposite ends. */
export function batteryMatch(a: SocialBattery, b: SocialBattery): number {
  return 1 - Math.abs(BATTERY_ORDER.indexOf(a) - BATTERY_ORDER.indexOf(b)) / 2;
}

export function novelty(a: RoomRider, b: RoomRider): number {
  // TODO: use lifetime times_met; 1 = never met.
  return 1;
}

export function scorePair(a: RoomRider, b: RoomRider, state: RoomState): PairScore {
  const carOrder = state.trip?.carOrder ?? [];
  return {
    carDistance: carDistance(carOrder, a.car, b.car),
    interest: interestScore(a.profile, b.profile, sharedTags(a, b).length),
    battery: batteryMatch(a.profile.socialBattery, b.profile.socialBattery),
    novelty: novelty(a, b),
  };
}

/** Negative when x is the better pair. */
export function comparePairScores(x: PairScore, y: PairScore): number {
  return (
    x.carDistance - y.carDistance ||
    y.interest - x.interest ||
    y.battery - x.battery ||
    y.novelty - x.novelty
  );
}
