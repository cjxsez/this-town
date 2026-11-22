/**
 * matching/pair.ts: greedy pairing and the meeting point.
 *
 * Responsible for (architecture.md "Matching", steps 4 and 5):
 * - `greedyPairs()`: from the pool, build every allowed pair (pool.ts passesGate), score it
 *   (score.ts), take the best pair overall, lock both riders, repeat. At most one partner
 *   per rider at a time.
 * - `meetingPoint()`: the kiosk in the car of whichever rider has more time left before their
 *   stop stays put; the other walks. Same car means nobody walks.
 * - `carDelta()`: what MatchFoundEvent.carDelta means for a given rider (0 same car, -1 one
 *   car back, +2 two cars forward).
 *
 * TrainRoom turns each ProposedPair into a RoomPair (color from colors.ts, why from
 * llm/why.ts), then sends match.found / pair.incoming.
 *
 * Protocol types: CarId, InterestTag, MatchFoundEvent (meetAtCar, carDelta, youWalk).
 *
 * When a car is missing from carOrder, carDelta returns 0 (wire type stays an int). Clients
 * must treat carDelta === 0 with meetAtCar !== the rider's current car as "Go to car <label>"
 * instead of "same car".
 */
import type { CarId, InterestTag } from "@questline/protocol";
import type { RoomRider, RoomState } from "../rooms/state";
import { passesGate, remainingSegments, sharedTags, type GateOptions } from "./pool";
import { comparePairScores, scorePair, type PairScore } from "./score";

export interface ProposedPair {
  a: RoomRider;
  b: RoomRider;
  score: PairScore;
  sharedTags: InterestTag[];
  meetAtCar: CarId;
  /** userId of the rider who walks; null when same car. */
  walker: string | null;
}

export function busyKiosks(state: RoomState): Set<CarId> {
  return new Set(Object.values(state.pairs).map((p) => p.meetAtCar));
}

export function meetingPoint(
  a: RoomRider,
  b: RoomRider,
  state: RoomState,
): { meetAtCar: CarId; walker: string | null } {
  if (a.car === b.car) return { meetAtCar: a.car, walker: null };
  const ra = remainingSegments(a, state);
  const rb = remainingSegments(b, state);
  // More stops left = stays put. Tie: whoever just sat down stays; the one already waiting walks over.
  const aStays = ra > rb || (ra === rb && a.checkedInAt >= b.checkedInAt);
  const stayer = aStays ? a : b;
  const walker = aStays ? b : a;
  // A kiosk hosts one pair at a time. If the stayer's kiosk is busy, meet at the other one.
  const busy = busyKiosks(state);
  if (busy.has(stayer.car) && !busy.has(walker.car)) return { meetAtCar: walker.car, walker: stayer.userId };
  return { meetAtCar: stayer.car, walker: walker.userId };
}

/**
 * carOrder is front first, so a positive delta means the kiosk is forward of you.
 * Unknown cars (not in carOrder) return 0; clients compare meetAtCar to the rider's car
 * and fall back to "Go to car <label>" when they differ.
 */
export function carDelta(carOrder: readonly CarId[], fromCar: CarId, toCar: CarId): number {
  if (fromCar === toCar) return 0;
  const from = carOrder.indexOf(fromCar);
  const to = carOrder.indexOf(toCar);
  if (from < 0 || to < 0) return 0;
  return from - to;
}

export function greedyPairs(pool: RoomRider[], state: RoomState, opts: GateOptions): ProposedPair[] {
  const candidates: ProposedPair[] = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i]!;
      const b = pool[j]!;
      if (!passesGate(a, b, state, opts)) continue;
      candidates.push({ a, b, score: scorePair(a, b, state), sharedTags: sharedTags(a, b), meetAtCar: a.car, walker: null });
    }
  }
  candidates.sort((x, y) => comparePairScores(x.score, y.score));

  const taken = new Set<string>();
  const kiosks = busyKiosks(state);
  const out: ProposedPair[] = [];
  for (const c of candidates) {
    if (taken.has(c.a.userId) || taken.has(c.b.userId)) continue;
    // Meeting point is decided against kiosks already claimed in this round too.
    const view: RoomState = { ...state, pairs: { ...state.pairs } };
    for (const car of kiosks) view.pairs[`claimed:${car}`] = { meetAtCar: car } as RoomState["pairs"][string];
    const { meetAtCar, walker } = meetingPoint(c.a, c.b, view);
    if (kiosks.has(meetAtCar)) continue; // both kiosks busy: wait for one to free up
    taken.add(c.a.userId);
    taken.add(c.b.userId);
    kiosks.add(meetAtCar);
    out.push({ ...c, meetAtCar, walker });
  }
  return out;
}
