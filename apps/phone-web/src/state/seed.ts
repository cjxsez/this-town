// Demo history so Passport, People and Memories aren't empty on first run.
// Mirrors the people and stamps drawn in the hi-fi screens (Dev, Lena, Jo, Ravi).
import { badgeFor } from "../../shared/catalog";
import type { Memory, Person, Profile, Stamp } from "../../shared/types";

const daysAgo = (d: number, h = 21, m = 0) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(h, m, 0, 0);
  return t.toISOString();
};

export const DEMO_PROFILE: Profile = {
  id: "me",
  firstName: "Sam",
  kind: "student",
  is18: true,
  interests: ["ramen", "thrifting", "coffee"],
  spots: ["fenway-park", "trident"],
  askMeAbout: "the best bowl in Allston",
  battery: "chat",
  useAi: false,
  handles: { instagram: "sam.rides" },
  badge: badgeFor(23), // orange owl
  homeStation: "kenmore",
  hasGlasses: false,
  createdAt: daysAgo(10),
};

export const SEED_PEOPLE: Person[] = [
  {
    id: "p-dev",
    firstName: "Dev",
    badge: badgeFor(15),
    pronoun: "he",
    metAtStationId: "bu-east",
    metAt: daysAgo(2, 18, 40),
    quests: 1,
    askMeAbout: "where to get a bagel at 2 am",
    stayInTouch: "connected",
    handles: { instagram: "dev.eats" },
  },
  {
    id: "p-lena",
    firstName: "Lena",
    badge: badgeFor(13),
    pronoun: "she",
    metAtStationId: "park-st",
    metAt: daysAgo(7, 8, 15),
    quests: 1,
    stayInTouch: "off",
  },
  {
    id: "p-jo",
    firstName: "Jo",
    badge: badgeFor(31),
    pronoun: "they",
    metAtStationId: "park-st",
    metAt: daysAgo(0, 8, 5),
    quests: 1,
    stayInTouch: "off",
  },
  {
    id: "p-ravi",
    firstName: "Ravi",
    badge: badgeFor(41),
    pronoun: "he",
    metAtStationId: "copley",
    metAt: daysAgo(4, 17, 30),
    quests: 2,
    askMeAbout: "pickup soccer on the Esplanade",
    stayInTouch: "waiting",
  },
];

export const SEED_STAMPS: Stamp[] = [
  {
    id: "s-bu-east",
    stationId: "bu-east",
    line: "green",
    branch: "B",
    earnedAt: daysAgo(2, 18, 40),
    rare: true,
    delayNote: "train was 7 min late",
    missionId: "excuse",
    withPersonId: "p-dev",
    memoryId: "m-dev",
  },
  { id: "s-park", stationId: "park-st", line: "green", earnedAt: daysAgo(7, 8, 15), rare: false, missionId: "rps", withPersonId: "p-lena" },
  { id: "s-copley", stationId: "copley", line: "green", earnedAt: daysAgo(4, 17, 30), rare: false, missionId: "sell-spot", withPersonId: "p-ravi", memoryId: "m-ravi" },
];

export const SEED_MEMORIES: Memory[] = [
  {
    id: "m-jo",
    personId: "p-jo",
    stationId: "park-st",
    takenAt: daysAgo(0, 8, 5),
    rare: false,
    status: "deciding",
    youKept: false,
    expiresAt: new Date(Date.now() + 11 * 3600 * 1000).toISOString(),
  },
  { id: "m-dev", personId: "p-dev", stationId: "bu-east", takenAt: daysAgo(2, 18, 40), rare: true, status: "kept", youKept: true },
  { id: "m-ravi", personId: "p-ravi", stationId: "copley", takenAt: daysAgo(4, 17, 30), rare: false, status: "kept", youKept: true },
];
