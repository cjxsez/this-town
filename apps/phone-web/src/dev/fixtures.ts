// Ride states for every ride screen, so /screens/:id can render any phase directly for
// design review without playing the flow.
import { MISSIONS } from "../../shared/catalog";
import type { CheckIn, Match, Stamp } from "../../shared/types";
import { initialRide, type RideState } from "../state/ride";

const maya: Match = { id: "p-maya", firstName: "Maya", color: "orange", shared: ["ramen", "coffee"], game: { code: "1234", seat: "a" }, why: "You both like ramen and coffee" };

export function rideFixture(id: string, now = Date.now()): RideState {
  const checkIn: CheckIn = {
    car: "1412",
    line: "green",
    branch: "D",
    nextStationId: "hynes",
    nextStationName: "Hynes",
    destinationId: "gov-ctr",
    destinationName: "Government Ctr",
  };
  const base: RideState = { ...initialRide, checkIn, phase: "riding", nextStopAt: now + 250_000, ridersOnTrain: 4 };
  const matched: RideState = { ...base, match: maya, meet: { car: "1413", carDelta: 1, youWalk: true }, nextStopAt: now + 200_000 };
  const mission = { mission: MISSIONS[0]!, startedAt: now - 10_000, endsAt: now + 110_000 };
  const stamp: Stamp = {
    id: "s-x",
    stationId: "hynes",
    stationName: "Hynes",
    line: "green",
    branch: "D",
    earnedAt: new Date(now).toISOString(),
    rare: false,
    missionId: "rename-station",
    withPersonId: "p-maya",
    withFirstName: "Maya",
  };
  switch (id) {
    case "C1": return { ...initialRide, checkIn };
    case "C2": return base;
    case "C3": return { ...base, online: false, nextStopAt: now + 210_000 };
    case "C4": return { ...base, phase: "rideOver", rideOverReason: "stop", stampsThisRide: 1, peopleThisRide: 1, nextStopAt: undefined };
    case "C5": return { ...base, phase: "rideOver", rideOverReason: "you", nextStopAt: undefined };
    case "D3": return { ...base, phase: "fellThrough", fellThroughReason: "partner" };
    case "D4": return { ...base, phase: "fellThrough", fellThroughReason: "you" };
    case "E1": return { ...matched, phase: "meet" };
    case "E2": return { ...matched, phase: "meet", meet: { car: "1412", carDelta: 0, youWalk: false } };
    case "E3": return { ...matched, phase: "meet", arrived: true, meet: { car: "1413", carDelta: 0, youWalk: true } };
    case "F1": return { ...matched, phase: "mission", arrived: true, mission };
    case "F3": return { ...matched, phase: "mission", arrived: true, mission, taps: 1, youTapped: true };
    case "G2": return { ...matched, phase: "stamp", mission, stamp, taps: 2, youTapped: true, stampsThisRide: 1 };
    case "H1": return { ...matched, phase: "recap", mission, stamp, note: "Fenway Basement", stampsThisRide: 1 };
    default: return base;
  }
}
