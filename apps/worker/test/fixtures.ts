// Builders for room state in tests: a small demo-like trip and riders with sensible defaults.
import type { InterestTag } from "@questline/protocol";
import { emptyRoomState, type RoomRider, type RoomState } from "../src/rooms/state";

/** Five stops A..E; the train is between A and B (current A, next B). Cars front to back. */
export function room(patch: Partial<RoomState> = {}): RoomState {
  const stops = ["A", "B", "C", "D", "E"].map((id, i) => ({ stopId: id, name: `Stop ${id}`, sequence: i + 1, etaMs: null }));
  return {
    ...emptyRoomState(),
    trip: { tripId: "t1", line: "Orange", routeId: "Orange", directionId: 0, carOrder: ["1", "2", "3", "4"], demo: false },
    stops,
    currentStopIdx: 0,
    nextStopIdx: 1,
    nextStopEtaMs: 0,
    ...patch,
  };
}

let seq = 0;

/** A matchable rider in car 1 riding to the last stop. */
export function rider(userId: string, patch: Partial<RoomRider> & { interests?: InterestTag[] } = {}): RoomRider {
  const { interests, ...rest } = patch;
  return {
    userId,
    car: "1",
    boardedStop: "A",
    destinationStop: "E",
    ghost: false,
    notNowUntil: 0,
    checkinId: `chk-${userId}`,
    checkedInAt: ++seq,
    profile: { firstName: userId, interests: interests ?? ["ramen", "coffee"], askMeAbout: "", socialBattery: "chat" },
    metRecently: [],
    blocked: [],
    recentTemplates: [],
    eligibleFromStopIdx: 0,
    pairId: null,
    ...rest,
  };
}

export function withRiders(state: RoomState, ...riders: RoomRider[]): RoomState {
  return { ...state, riders: Object.fromEntries(riders.map((r) => [r.userId, r])) };
}
