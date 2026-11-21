// Static catalog. The matcher compares ids, so chip labels must match these
// exactly; that is why onboarding has no free-text interest field.
import type {
  Badge,
  BadgeAnimal,
  BadgeColor,
  Direction,
  GreenBranch,
  LineColor,
  MeetSpot,
  Mission,
  Station,
} from "./types";

export const LINES: Record<LineColor, { label: string; hex: string; dark: string }> = {
  green: { label: "Green", hex: "#3F8F5A", dark: "#2E6E46" },
  red: { label: "Red", hex: "#D9453B", dark: "#A8360F" },
  orange: { label: "Orange", hex: "#E8893A", dark: "#C4472A" },
  blue: { label: "Blue", hex: "#3B74C4", dark: "#26343B" },
};

// ---- badges: 6 colours x 8 animals = 48 printed badges ----

export const BADGE_COLORS: Record<BadgeColor, string> = {
  red: "#D9453B",
  yellow: "#F2C84B",
  orange: "#F0923B",
  blue: "#6BBDE6",
  teal: "#17736F",
  purple: "#8A5A8C",
};
const COLOR_ORDER: BadgeColor[] = ["red", "yellow", "orange", "blue", "teal", "purple"];
const ANIMAL_ORDER: BadgeAnimal[] = ["cat", "bear", "frog", "owl", "rabbit", "fox", "duck", "deer"];

/**
 * Colour and animal are computed from the printed number, so the badge is the
 * only thing that has to be stored. Multiplying by 5 (coprime to 48) scatters
 * neighbouring numbers so a stack of badges doesn't come out all one colour.
 */
export function badgeFor(number: number): Badge {
  const n = (((number * 5) % 48) + 48) % 48;
  return { number, color: COLOR_ORDER[Math.floor(n / 8) % 6], animal: ANIMAL_ORDER[n % 8] };
}

export const badgeName = (b: Badge) => `${b.color} ${b.animal}`;

// ---- stations (the 14 in the demo catalog, plus passport placeholders) ----

export const STATIONS: Station[] = [
  { id: "kenmore", name: "Kenmore", short: "KEN-MORE", lines: ["green"], branches: ["B", "C", "D"] },
  { id: "bu-east", name: "BU East", short: "BU EAST", lines: ["green"], branches: ["B"] },
  { id: "bu-central", name: "BU Central", short: "BU CTR", lines: ["green"], branches: ["B"] },
  { id: "amory", name: "Amory St", short: "AMORY", lines: ["green"], branches: ["B"] },
  { id: "babcock", name: "Babcock St", short: "BABC-OCK", lines: ["green"], branches: ["B"] },
  { id: "blandford", name: "Blandford St", short: "BLAND-FORD", lines: ["green"], branches: ["B"] },
  { id: "hynes", name: "Hynes", short: "HYN-ES", lines: ["green"], branches: ["B", "C", "D"] },
  { id: "copley", name: "Copley", short: "COP-LEY", lines: ["green"], branches: ["B", "C", "D", "E"] },
  { id: "arlington", name: "Arlington", short: "ARL.", lines: ["green"], branches: ["B", "C", "D", "E"] },
  { id: "park-st", name: "Park St", short: "PARK ST", lines: ["green", "red"], branches: ["B", "C", "D", "E"] },
  { id: "gov-ctr", name: "Government Ctr", short: "GOV CTR", lines: ["green", "blue"], branches: ["B", "C", "D", "E"] },
  { id: "downtown-crossing", name: "Downtown Crossing", short: "DTX", lines: ["red", "orange"] },
  { id: "harvard", name: "Harvard", short: "HAR-VARD", lines: ["red"] },
  { id: "aquarium", name: "Aquarium", short: "AQUA-RIUM", lines: ["blue"] },
];

export const stationById = (id: string) => STATIONS.find((s) => s.id === id);

/** Passport layout: stations in line order, grouped the way the line map draws them. */
export const PASSPORT_LAYOUT: Record<LineColor, { group: string; stationIds: string[]; more: boolean }[]> = {
  green: [
    { group: "B BRANCH", stationIds: ["kenmore", "bu-east", "bu-central", "amory", "babcock"], more: true },
    { group: "TRUNK", stationIds: ["park-st", "arlington", "copley", "hynes"], more: true },
  ],
  red: [{ group: "TRUNK", stationIds: ["park-st", "downtown-crossing", "harvard"], more: true }],
  orange: [{ group: "TRUNK", stationIds: ["downtown-crossing"], more: true }],
  blue: [{ group: "TRUNK", stationIds: ["gov-ctr", "aquarium"], more: true }],
};

export const LINE_STATION_COUNT: Record<LineColor, number> = { green: 66, red: 22, orange: 20, blue: 12 };

/** Locals say "outbound", visitors read the destination sign, so both are shown. */
export const DIRECTIONS: Record<LineColor, Direction[]> = {
  green: [
    { id: "westbound", label: "Westbound", towards: "to Boston College" },
    { id: "eastbound", label: "Eastbound", towards: "to Gov't Ctr" },
  ],
  red: [
    { id: "northbound", label: "Northbound", towards: "to Alewife" },
    { id: "southbound", label: "Southbound", towards: "to Ashmont / Braintree" },
  ],
  orange: [
    { id: "northbound", label: "Northbound", towards: "to Oak Grove" },
    { id: "southbound", label: "Southbound", towards: "to Forest Hills" },
  ],
  blue: [
    { id: "outbound", label: "Outbound", towards: "to Wonderland" },
    { id: "inbound", label: "Inbound", towards: "to Bowdoin" },
  ],
};

export const GREEN_BRANCHES: GreenBranch[] = ["B", "C", "D", "E"];

// ---- interests: chips only ----

export interface Interest {
  id: string;
  label: string;
  category: InterestCategory;
  featured?: boolean;
}
export type InterestCategory = "Food" | "Sports" | "Arts" | "Active" | "Games" | "Tech" | "City";
export const INTEREST_CATEGORIES: InterestCategory[] = ["Food", "Sports", "Arts", "Active", "Games", "Tech", "City"];

const I = (id: string, label: string, category: InterestCategory, featured = false): Interest => ({
  id,
  label,
  category,
  featured,
});

export const INTERESTS: Interest[] = [
  I("ramen", "ramen", "Food", true),
  I("red-sox", "Red Sox", "Sports", true),
  I("thrifting", "thrifting", "City", true),
  I("running", "running", "Active", true),
  I("live-music", "live music", "Arts", true),
  I("coffee", "coffee", "Food", true),
  I("board-games", "board games", "Games", true),
  I("museums", "museums", "Arts", true),
  I("hiking", "hiking", "Active", true),
  I("anime", "anime", "Arts", true),
  I("photography", "photography", "Arts", true),
  I("cooking", "cooking", "Food", true),
  I("dumplings", "dumplings", "Food"),
  I("baking", "baking", "Food"),
  I("cannoli", "cannoli", "Food"),
  I("celtics", "Celtics", "Sports"),
  I("bruins", "Bruins", "Sports"),
  I("soccer", "soccer", "Sports"),
  I("marathon", "the Marathon", "Sports"),
  I("theater", "theater", "Arts"),
  I("comics", "comics", "Arts"),
  I("film", "film", "Arts"),
  I("climbing", "climbing", "Active"),
  I("cycling", "cycling", "Active"),
  I("rowing", "rowing", "Active"),
  I("chess", "chess", "Games"),
  I("video-games", "video games", "Games"),
  I("trivia", "trivia", "Games"),
  I("ai", "AI", "Tech"),
  I("hackathons", "hackathons", "Tech"),
  I("robotics", "robotics", "Tech"),
  I("history", "Boston history", "City"),
  I("bookstores", "bookstores", "City"),
  I("architecture", "architecture", "City"),
];

export const interestById = (id: string) => INTERESTS.find((i) => i.id === id);

// ---- favourite spots, per station (B4 shows the poster's station) ----

export const SPOTS: Record<string, { id: string; label: string }[]> = {
  kenmore: [
    { id: "fenway-park", label: "Fenway Park" },
    { id: "pavement", label: "Pavement Coffee" },
    { id: "the-fens", label: "the Fens" },
    { id: "trident", label: "Trident Books" },
    { id: "citgo", label: "Citgo sign" },
    { id: "lansdowne", label: "Lansdowne St" },
  ],
  "park-st": [
    { id: "common", label: "Boston Common" },
    { id: "frog-pond", label: "Frog Pond" },
    { id: "state-house", label: "State House" },
    { id: "brattle", label: "Brattle Book Shop" },
    { id: "public-garden", label: "Public Garden" },
    { id: "chinatown", label: "Chinatown gate" },
  ],
  copley: [
    { id: "bpl", label: "Boston Public Library" },
    { id: "trinity", label: "Trinity Church" },
    { id: "newbury", label: "Newbury St" },
    { id: "finish-line", label: "the Marathon finish" },
    { id: "pru", label: "the Pru" },
    { id: "tatte", label: "Tatte" },
  ],
};

export const spotsFor = (stationId: string) => SPOTS[stationId] ?? SPOTS.kenmore;

// ---- meeting spots: things already on the platform, never hardware ----

export const MEET_SPOTS: Record<string, MeetSpot[]> = {
  kenmore: [
    { id: "system-map", name: "The system map", detail: "near the stairs" },
    { id: "third-bench", name: "The third bench", detail: "westbound side" },
    { id: "comm-ave-stairs", name: "The stairs to Comm Ave", detail: "bottom step" },
  ],
};

// ---- missions: 5 groups, 20 total ----

const M = (m: Mission) => m;
export const MISSION_GROUP_LABEL: Record<Mission["group"], string> = {
  create: "CREATE",
  showMe: "SHOW ME · LOCAL + VISITOR",
  spot: "SPOT",
  quickGame: "QUICK GAME · NOD-FRIENDLY",
  lateBonus: "LATE BONUS ★ · DELAY ONLY",
};

export const MISSIONS: Mission[] = [
  M({ id: "rename-station", group: "create", rarity: "common", title: "Rename {station} together.", body: "Best name wins. Agree on one out loud.", seconds: 120 }),
  M({ id: "new-line-color", group: "create", rarity: "common", title: "Invent a fifth T line.", body: "Pick its colour and where it goes.", seconds: 120 }),
  M({ id: "station-mascot", group: "create", rarity: "common", title: "Give {station} a mascot.", body: "Name it and give it one catchphrase.", seconds: 120 }),
  M({ id: "jingle", group: "create", rarity: "common", title: "Write a 4-word jingle for this line.", body: "Say it together once.", seconds: 90 }),
  M({ id: "sell-spot", group: "showMe", rarity: "common", title: "Sell {name} on one spot above ground in 60 s.", body: "Then swap.", seconds: 120 }),
  M({ id: "first-week", group: "showMe", rarity: "common", title: "One thing every first-week visitor gets wrong.", body: "Each of you, one tip.", seconds: 90 }),
  M({ id: "best-bite", group: "showMe", rarity: "common", title: "Best bite within one stop of here.", body: "Agree on a winner.", seconds: 90 }),
  M({ id: "hidden-gem", group: "showMe", rarity: "common", title: "A free thing in Boston nobody does.", body: "Trade one each.", seconds: 90 }),
  M({ id: "three-teal", group: "spot", rarity: "common", title: "Find 3 things on this platform that are teal.", body: "Point, don't walk off.", seconds: 90 }),
  M({ id: "oldest-thing", group: "spot", rarity: "common", title: "Spot the oldest thing on this platform.", body: "Make your case.", seconds: 90 }),
  M({ id: "count-signs", group: "spot", rarity: "common", title: "Count the station-name signs you can see.", body: "Closest guess first, then count.", seconds: 60 }),
  M({ id: "best-ad", group: "spot", rarity: "common", title: "Pick the best ad on this platform.", body: "Then the worst.", seconds: 60 }),
  M({ id: "rps", group: "quickGame", rarity: "common", title: "Rock-paper-scissors, best of 3.", body: "Loser names the next stop.", seconds: 60, nodFriendly: true }),
  M({ id: "thumb-war", group: "quickGame", rarity: "common", title: "Would you rather: T or bike?", body: "One sentence each.", seconds: 45, nodFriendly: true }),
  M({ id: "two-truths", group: "quickGame", rarity: "common", title: "Two truths, one lie. Boston edition.", body: "Guess theirs.", seconds: 90, nodFriendly: true }),
  M({ id: "high-low", group: "quickGame", rarity: "common", title: "Higher or lower: years this station is old.", body: "Three guesses.", seconds: 45, nodFriendly: true }),
  M({ id: "excuse", group: "lateBonus", rarity: "rare", title: "Invent the excuse the train is using.", body: "Most believable wins.", seconds: 180, delayOnly: true }),
  M({ id: "delay-forecast", group: "lateBonus", rarity: "rare", title: "Bet on the real arrival time.", body: "Closest guess wins bragging rights.", seconds: 180, delayOnly: true }),
  M({ id: "delay-announcement", group: "lateBonus", rarity: "rare", title: "Write the announcement you wish they'd make.", body: "Perform it quietly.", seconds: 180, delayOnly: true }),
  M({ id: "delay-plan-b", group: "lateBonus", rarity: "rare", title: "Plan B: walk, bike or wait?", body: "Agree, then stay anyway.", seconds: 180, delayOnly: true }),
];

export const missionById = (id: string) => MISSIONS.find((m) => m.id === id);

/** Fill {station} / {name} placeholders in a mission title. */
export const missionText = (s: string, vars: { station?: string; name?: string }) =>
  s.replace("{station}", vars.station ?? "this station").replace("{name}", vars.name ?? "them");
