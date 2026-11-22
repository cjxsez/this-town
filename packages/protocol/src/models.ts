// Core domain models shared by the worker and every client.
// Keep this file free of runtime deps besides zod.
import { z } from "zod";
import { PAIR_COLORS } from "./colors";

/**
 * Interest ids. Same ids as the phone's catalog (apps/phone-web/shared/catalog.ts INTERESTS),
 * which owns the labels and categories. Add an interest in both places.
 */
export const InterestTag = z.enum([
  "ramen", "red-sox", "thrifting", "running", "live-music", "coffee", "board-games",
  "museums", "hiking", "anime", "photography", "cooking", "dumplings", "baking",
  "cannoli", "celtics", "bruins", "soccer", "marathon", "theater", "comics", "film",
  "climbing", "cycling", "rowing", "chess", "video-games", "trivia", "ai",
  "hackathons", "robotics", "history", "bookstores", "architecture",
]);
export type InterestTag = z.infer<typeof InterestTag>;

/** Same names as the phone design: "just a nod" / "quick chat" / "let's talk". */
export const SocialBattery = z.enum(["nod", "chat", "talk"]);
export type SocialBattery = z.infer<typeof SocialBattery>;

export const RiderStatus = z.enum(["local", "student", "visiting"]);
export type RiderStatus = z.infer<typeof RiderStatus>;

/**
 * Stop ids are slugs that match the phone's station catalog ids ("kenmore", "park-st",
 * "gov-ctr"), so stamps and art line up. Names are for display.
 */
export const Stop = z.object({ id: z.string(), name: z.string() });
export type Stop = z.infer<typeof Stop>;

/** What a rider fills in during onboarding. */
export const Profile = z.object({
  firstName: z.string().min(1).max(24),
  interests: z.array(InterestTag).min(3).max(8),
  askMeAbout: z.string().max(80).default(""),
  socialBattery: SocialBattery,
  status: RiderStatus,
  languages: z.array(z.string().max(24)).max(5).default([]),
  is18Plus: z.literal(true),
});
export type Profile = z.infer<typeof Profile>;

/** Pair colors. The kiosk LEDs, kiosk screen and glasses all use the same names. */
export const PairColor = z.enum(PAIR_COLORS);
export type PairColor = z.infer<typeof PairColor>;
export { PAIR_COLOR_HEX, RARE_ACCENT_HEX } from "./colors";

export const MissionCategory = z.enum(["create", "show-me", "spot", "quick-game", "late-bonus"]);
export type MissionCategory = z.infer<typeof MissionCategory>;

/** A car is identified by the number printed on it (MBTA carriage label), e.g. "1412". */
export const CarId = z.string().regex(/^[A-Za-z0-9-]{1,12}$/);
export type CarId = z.infer<typeof CarId>;

export const Line = z.enum(["Red", "Orange", "Blue", "Green-B", "Green-C", "Green-D", "Green-E"]);
export type Line = z.infer<typeof Line>;

/** Live state of a rider on a train, as the rider sees it. */
export const RideState = z.object({
  status: z.enum(["off", "riding", "matched", "in-mission"]),
  tripId: z.string().nullable(),
  line: Line.nullable(),
  car: CarId.nullable(),
  destinationStop: z.string().nullable(),   // display name
  destinationStopId: z.string().nullable(),
  nextStop: z.string().nullable(),          // display name
  nextStopId: z.string().nullable(),
  nextStopEtaSec: z.number().int().nullable(),
  ridersOnTrain: z.number().int(),
  ghost: z.boolean(),
});
export type RideState = z.infer<typeof RideState>;

export const Partner = z.object({
  firstName: z.string(),
  color: PairColor,
  sharedTags: z.array(InterestTag),
});
export type Partner = z.infer<typeof Partner>;

export const Mission = z.object({
  sessionId: z.string(),
  templateId: z.string(),
  category: MissionCategory,
  title: z.string(),
  prompt: z.string(),
  endsAt: z.number().int(), // epoch ms
  rare: z.boolean(),
});
export type Mission = z.infer<typeof Mission>;

export const Stamp = z.object({
  id: z.string(),
  stationId: z.string(), // stop id, matches the phone catalog
  station: z.string(),
  line: Line,
  partnerFirstName: z.string(),
  rare: z.boolean(),
  awardedAt: z.number().int(),
});
export type Stamp = z.infer<typeof Stamp>;

/**
 * The rider's current match, as sent in match.found and in snapshots.
 * carDelta: cars from the rider's current car to meetAtCar. Positive = toward the front
 * of the train, negative = toward the back, 0 = same car.
 */
export const MatchInfo = z.object({
  matchId: z.string(),
  partner: Partner,
  why: z.string(),             // "You both love ramen and are riding to Park St"
  meetAtCar: CarId,            // whose kiosk to go to
  carDelta: z.number().int(),
  youWalk: z.boolean(),        // false = stay put, they come to you
  // The two-player game room opened for this pair (games/client.ts) and this rider's seat in
  // it, so both phones can go straight to /m without a code. Absent if no room could be opened.
  game: z.object({ code: z.string().regex(/^\d{4}$/), seat: z.enum(["a", "b"]) }).optional(),
});
export type MatchInfo = z.infer<typeof MatchInfo>;

/** Everything a client needs to redraw after a reload or reconnect. */
export const RideSnapshot = z.object({
  state: RideState,
  match: MatchInfo.nullable(),
  mission: Mission.nullable(),
  serverNow: z.number().int(), // epoch ms; clients use it to correct countdowns for clock skew
});
export type RideSnapshot = z.infer<typeof RideSnapshot>;
