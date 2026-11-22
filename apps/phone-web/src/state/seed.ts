// Demo history so Passport and People aren't empty on first run (mock mode).
import type { Person, Profile, Stamp } from "../../shared/types";

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
  askMeAbout: "the best bowl in Allston",
  battery: "chat",
  rulesAccepted: true,
  glassesLinked: true,
  createdAt: daysAgo(10),
};

export const SEED_PEOPLE: Person[] = [
  { id: "p-dev", firstName: "Dev", color: "green", metAtStationId: "bu-east", metAt: daysAgo(2, 18, 40), quests: 1 },
  { id: "p-lena", firstName: "Lena", color: "blue", metAtStationId: "park-st", metAt: daysAgo(7, 8, 15), quests: 1 },
  { id: "p-jo", firstName: "Jo", color: "pink", metAtStationId: "park-st", metAt: daysAgo(0, 8, 5), quests: 1 },
  { id: "p-ravi", firstName: "Ravi", color: "yellow", metAtStationId: "copley", metAt: daysAgo(4, 17, 30), quests: 2 },
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
    withFirstName: "Dev",
  },
  { id: "s-park", stationId: "park-st", line: "green", earnedAt: daysAgo(7, 8, 15), rare: false, missionId: "rps", withPersonId: "p-lena", withFirstName: "Lena" },
  { id: "s-copley", stationId: "copley", line: "green", earnedAt: daysAgo(4, 17, 30), rare: false, missionId: "sell-spot", withPersonId: "p-ravi", withFirstName: "Ravi" },
];
