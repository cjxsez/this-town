// Domain + API shapes shared by the React app and the Worker.
// The backend team implements these; the frontend only ever talks in these types.

export type LineColor = "green" | "red" | "orange" | "blue";
export type GreenBranch = "B" | "C" | "D" | "E";
export type RiderKind = "local" | "student" | "visiting";
export type SocialBattery = "nod" | "chat" | "talk";
export type TimeOfDay = "Day" | "Dusk" | "Night";

export type BadgeColor = "red" | "yellow" | "orange" | "blue" | "teal" | "purple";
export type BadgeAnimal = "cat" | "bear" | "frog" | "owl" | "rabbit" | "fox" | "duck" | "deer";

export interface Badge {
  number: number;
  color: BadgeColor;
  animal: BadgeAnimal;
}

export interface Handles {
  instagram?: string;
  snapchat?: string;
}

export interface Profile {
  id: string;
  firstName: string;
  kind: RiderKind;
  is18: boolean;
  interests: string[]; // interest ids from the catalog
  spots: string[]; // spot ids from the catalog
  askMeAbout?: string;
  battery: SocialBattery;
  useAi: boolean;
  handles: Handles;
  badge?: Badge;
  homeStation: string; // station id the rider joined from (the QR poster)
  hasGlasses: boolean;
  createdAt: string;
}

export interface Station {
  id: string;
  name: string;
  short: string; // ticket label, e.g. "KEN-MORE"
  lines: LineColor[];
  branches?: GreenBranch[];
}

export interface Direction {
  id: "westbound" | "eastbound" | "inbound" | "outbound" | "northbound" | "southbound";
  label: string; // "Westbound"
  towards: string; // "to Boston College"
}

export interface CheckIn {
  stationId: string;
  line: LineColor;
  branch?: GreenBranch;
  direction: Direction["id"];
  via: "beacon" | "list";
}

export type MissionGroup = "create" | "showMe" | "spot" | "quickGame" | "lateBonus";

export interface Mission {
  id: string;
  group: MissionGroup;
  rarity: "common" | "rare";
  title: string; // "Rename Kenmore together."
  body: string; // "Best name wins. Agree on one out loud."
  seconds: number;
  delayOnly?: boolean;
  nodFriendly?: boolean;
}

/** The other rider, revealed only after both said yes. */
export interface Match {
  id: string;
  firstName: string;
  badge: Badge;
  pronoun: "she" | "he" | "they";
  askMeAbout?: string;
  hasGlasses: boolean;
}

export interface MeetSpot {
  id: string;
  name: string; // "The system map"
  detail: string; // "near the stairs"
  photo?: string; // url, for visitors
}

export interface Offer {
  id: string;
  why: string; // "Someone here also loves ramen." (template, never AI)
  minutes: number;
  rare: boolean;
  expiresAt: number; // epoch ms
}

export interface Stamp {
  id: string;
  stationId: string;
  line: LineColor;
  branch?: GreenBranch;
  earnedAt: string;
  rare: boolean;
  delayNote?: string; // "train was 7 min late"
  missionId: string;
  withPersonId: string;
  memoryId?: string;
}

export type StayInTouch = "off" | "waiting" | "connected";

export interface Person {
  id: string;
  firstName: string;
  badge: Badge;
  pronoun: "she" | "he" | "they";
  metAtStationId: string;
  metAt: string;
  quests: number;
  askMeAbout?: string;
  stayInTouch: StayInTouch;
  handles?: Handles; // only present when connected
  blocked?: boolean;
}

export interface Memory {
  id: string;
  personId: string;
  stationId: string;
  takenAt: string;
  rare: boolean;
  /** deciding: one or both haven't voted; kept: both kept. Deleted memories vanish. */
  status: "deciding" | "kept";
  youKept: boolean;
  expiresAt?: string; // for deciding
  imageUrl?: string;
}

export interface QuestRecap {
  stationId: string;
  at: string;
  person: Match;
  mission: Mission;
  note?: string; // "you called it Fenway Basement"
  photo: "none" | "waiting" | "kept";
  streak: number;
  stampId: string;
}

export type ReportReason = "uncomfortable" | "didntStop" | "photoWithoutAsking" | "other";

export interface GlassesStatus {
  connected: boolean;
  model: string;
  battery: number;
  neuralBand: boolean;
  readBadges: boolean;
  nodToAccept: boolean;
  sessionLive: boolean;
  cameraPaused: boolean;
  lastCardAt?: number;
}

/** What the lens is showing. Every update replaces the whole card. */
export type LensCard =
  | { kind: "waiting"; line: string; direction: string; trainIn: string }
  | { kind: "offer"; why: string; minutes: number }
  | { kind: "meet"; name: string; badge: string; spot: string; train: string }
  | { kind: "greeting"; name: string; opener: string; train: string }
  | { kind: "mission"; title: string; left: string; train: string }
  | { kind: "stamp"; station: string; name: string; askPhoto: boolean }
  | { kind: "trainSoon"; seconds: number };
