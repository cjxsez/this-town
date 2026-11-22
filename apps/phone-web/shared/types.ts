// Domain shapes the screens are written against. The wire contract is
// @questline/protocol; src/api/backend/map.ts converts between the two.
//
// The product (docs/architecture.md): tap the kiosk in your car and confirm Ride Mode
// (that is the consent), get matched with the closest rider on this train who shares your
// interests, meet at a kiosk, play the mission on its screen, both tap the tag for a stamp.

import type { PairColorName } from "@questline/protocol/colors";

export type LineColor = "green" | "red" | "orange" | "blue";
export type GreenBranch = "B" | "C" | "D" | "E";
export type RiderKind = "local" | "student" | "visiting";
export type SocialBattery = "nod" | "chat" | "talk";
export type TimeOfDay = "Day" | "Dusk" | "Night";
/** The color two matched riders share: kiosk LEDs, kiosk screen, glasses, phone. */
export type PairColor = PairColorName;

export interface Profile {
  id: string;
  firstName: string;
  kind: RiderKind;
  is18: boolean;
  interests: string[]; // interest ids from the catalog (= protocol InterestTag)
  askMeAbout?: string;
  battery: SocialBattery;
  /** The rider read the Ride Mode rules during onboarding. */
  rulesAccepted: boolean;
  /** Glasses linked with the 4-digit code (POST /api/glasses/link). */
  glassesLinked: boolean;
  createdAt: string;
  /** Verified sign-in email. Absent for "Just play today" guests. */
  email?: string;
}

export interface Station {
  id: string;
  name: string;
  short: string; // ticket label, e.g. "KEN-MORE"
  lines: LineColor[];
  branches?: GreenBranch[];
}

/** One stop the rider can pick as their destination. */
export interface StopOption {
  id: string; // station catalog id when we have one, e.g. "gov-ctr"
  name: string;
}

/** Where the rider is: which car of which train, and where they get off. */
export interface CheckIn {
  car: string; // number printed on the car, e.g. "1412"
  line: LineColor;
  branch?: GreenBranch;
  /** The stop the train is heading to now (catalog id). */
  nextStationId: string;
  nextStationName: string;
  destinationId: string;
  destinationName: string;
}

export type MissionGroup = "create" | "showMe" | "spot" | "quickGame" | "lateBonus";

export interface Mission {
  id: string;
  group: MissionGroup;
  rarity: "common" | "rare";
  title: string; // "Rename Hynes"
  body: string; // "Rename Hynes. Best name wins."
  seconds: number;
  delayOnly?: boolean;
  nodFriendly?: boolean;
}

/** The other rider. First name and pair color only, same as the glasses and kiosk show. */
export interface Match {
  id: string; // match id
  firstName: string;
  color: PairColor;
  /** Interest ids you share. */
  shared: string[];
  /** "You both like ramen and film". Private to the two riders, never on the kiosk. */
  why: string;
}

/** Where to meet: always a kiosk. */
export interface Meet {
  car: string;
  /** Cars from yours to the meeting kiosk: + toward the front, - toward the back, 0 yours. */
  carDelta: number;
  /** false: stay put, they come to you. */
  youWalk: boolean;
}

export interface Stamp {
  id: string;
  stationId: string;
  stationName?: string;
  line: LineColor;
  branch?: GreenBranch;
  earnedAt: string;
  rare: boolean;
  delayNote?: string; // "train was 7 min late"
  missionId: string;
  withPersonId: string;
  withFirstName?: string;
}

/** Someone you played with. Keyed by match id, which is what the worker reports against. */
export interface Person {
  id: string;
  firstName: string;
  color: PairColor;
  metAtStationId: string;
  metAt: string;
  quests: number;
  blocked?: boolean;
}

export interface QuestRecap {
  stationId: string;
  at: string;
  person: Match;
  mission?: Mission;
  note?: string; // "you called it Fenway Basement"
  stamped: boolean;
  stampId?: string;
}

export type ReportReason = "uncomfortable" | "didntStop" | "other";

/** What the lens is showing. Mirrors apps/glasses-web; every update replaces the whole card. */
export type LensCard =
  | { kind: "link"; code: string }
  | { kind: "riding"; nextStop: string; nextIn: string; riders: number }
  | { kind: "match"; name: string; color: PairColor; where: string; why: string }
  | { kind: "mission"; title: string; left: string; tapped: number }
  | { kind: "stamp"; station: string; name: string };
