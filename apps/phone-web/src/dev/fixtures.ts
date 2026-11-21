// Ride states for every wireframe screen, so /screens/:id can render any
// phase directly for design review without playing the flow.
import { MEET_SPOTS, MISSIONS, badgeFor } from "../../shared/catalog";
import type { Match } from "../../shared/types";
import { initialRide, type RideState } from "../state/ride";

const maya: Match = { id: "p-maya", firstName: "Maya", badge: badgeFor(17), pronoun: "she", askMeAbout: "the best bowl in Allston", hasGlasses: true };

export function rideFixture(id: string, now = Date.now()): RideState {
  const base: RideState = {
    ...initialRide,
    checkIn: { stationId: "kenmore", line: "green", branch: "B", direction: "westbound", via: "beacon" },
    phase: "waiting",
    trainAt: now + 250_000,
  };
  const offer = { id: "o1", why: "Someone here also loves ramen.", minutes: 3, rare: false, expiresAt: now + 25_000 };
  const matched = {
    ...base,
    offer,
    match: maya,
    meetSpot: MEET_SPOTS.kenmore[0],
    opener: { youFirst: true, say: "Is this the train to Narnia?", listenFor: "Only on Tuesdays." },
    trainAt: now + 180_000,
  };
  const mission = { mission: MISSIONS[0], startedAt: now - 10_000, endsAt: now + 110_000, swapped: false };
  const stamp = { id: "s-x", stationId: "kenmore", line: "green" as const, branch: "B" as const, earnedAt: new Date(now).toISOString(), rare: false, missionId: "rename-station", withPersonId: "p-maya" };
  switch (id) {
    case "C1": return { ...initialRide, checkIn: base.checkIn };
    case "C2": return base;
    case "C3": return { ...base, online: false, trainAt: now + 210_000 };
    case "C4": return { ...base, phase: "noMatch", trainAt: now };
    case "D1": return { ...base, phase: "offer", offer, trainAt: now + 210_000 };
    case "D2": return { ...base, phase: "offerYes", offer: { ...offer, expiresAt: now + 15_000 }, trainAt: now + 200_000 };
    case "D3": return { ...base, phase: "fellThrough", trainAt: now + 190_000 };
    case "D4": return { ...base, phase: "offer", delayed: true, delayMinutes: 7, trainAt: now + 540_000, offer: { ...offer, why: "Someone here is also stuck and also likes thrifting.", minutes: 5, rare: true } };
    case "E1": return { ...matched, phase: "meet" };
    case "E2": return { ...matched, phase: "cantSpot", youAtSpot: false, partnerAtSpotAt: now - 20_000, trainAt: now + 140_000 };
    case "E3": return { ...matched, phase: "greeting", metAt: now, badgeVerified: true, trainAt: now + 150_000 };
    case "F1": return { ...matched, phase: "mission", metAt: now - 20_000, mission, trainAt: now + 140_000 };
    case "F3": return { ...matched, phase: "mission", metAt: now - 90_000, mission, trainAt: now + 30_000, trainSoon: true };
    case "G1": return { ...matched, phase: "bump", metAt: now - 120_000, mission, bump: { deadline: now + 14_000, you: false, partner: true }, trainAt: now + 70_000 };
    case "G2": return { ...matched, phase: "stamp", metAt: now - 130_000, mission, stamp, stampsThisRide: 1, trainAt: now + 50_000 };
    case "G3": return { ...matched, phase: "photo", metAt: now - 140_000, mission, stamp, photo: { you: true, partner: true, taken: false }, trainAt: now + 40_000 };
    case "G4": return { ...matched, phase: "keep", metAt: now - 150_000, mission, stamp, photo: { you: true, partner: true, taken: true, keepDeadline: now + 86_340_000 }, trainAt: now };
    case "H1": return { ...matched, phase: "recap", metAt: now - 200_000, mission, stamp, note: "Fenway Basement", photo: { you: true, partner: true, taken: true, youKeep: true }, trainAt: now };
    default: return base;
  }
}
