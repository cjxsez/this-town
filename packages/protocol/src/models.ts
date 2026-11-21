// Core domain models shared by the worker and every client.
// Keep this file free of runtime deps besides zod.
import { z } from "zod";

export const InterestTag = z.enum([
  "music", "food", "coffee", "sports", "running", "climbing", "hiking",
  "startups", "tech", "ai", "design", "art", "photography", "film",
  "books", "writing", "gaming", "anime", "fashion", "cooking",
  "travel", "languages", "science", "history", "pets",
]);
export type InterestTag = z.infer<typeof InterestTag>;

export const SocialBattery = z.enum(["nod", "quick-chat", "lets-talk"]);
export type SocialBattery = z.infer<typeof SocialBattery>;

export const RiderStatus = z.enum(["local", "student", "visitor"]);
export type RiderStatus = z.infer<typeof RiderStatus>;

/** What a rider fills in during onboarding. */
export const Profile = z.object({
  firstName: z.string().min(1).max(24),
  interests: z.array(InterestTag).min(3).max(5),
  askMeAbout: z.string().max(80).default(""),
  socialBattery: SocialBattery,
  status: RiderStatus,
  languages: z.array(z.string().max(24)).max(5).default([]),
  is18Plus: z.literal(true),
});
export type Profile = z.infer<typeof Profile>;

/** Pair colors. The kiosk LEDs, kiosk screen and glasses all use the same names. */
export const PairColor = z.enum(["orange", "green", "blue", "pink", "yellow", "purple"]);
export type PairColor = z.infer<typeof PairColor>;

export const PAIR_COLOR_HEX: Record<PairColor, string> = {
  orange: "#ff8a00",
  green: "#22c55e",
  blue: "#3b82f6",
  pink: "#ec4899",
  yellow: "#facc15",
  purple: "#a855f7",
};

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
  destinationStop: z.string().nullable(),
  nextStop: z.string().nullable(),
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
  station: z.string(),
  line: Line,
  partnerFirstName: z.string(),
  rare: z.boolean(),
  awardedAt: z.number().int(),
});
export type Stamp = z.infer<typeof Stamp>;
