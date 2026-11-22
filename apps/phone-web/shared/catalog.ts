// Static catalog. The matcher compares ids, so chip labels must match these
// exactly; that is why onboarding has no free-text interest field.
import { T_STATIONS, stationsOn, type Branch as TBranch, type LineId as TLineId } from "@questline/t-map";
import type { GreenBranch, LineColor, Mission, Station } from "./types";

export const LINES: Record<LineColor, { label: string; hex: string; dark: string }> = {
  green: { label: "Green", hex: "#3F8F5A", dark: "#2E6E46" },
  red: { label: "Red", hex: "#D9453B", dark: "#A8360F" },
  orange: { label: "Orange", hex: "#E8893A", dark: "#C4472A" },
  blue: { label: "Blue", hex: "#3B74C4", dark: "#26343B" },
};

// ---- stations: every subway and light-rail stop, from @questline/t-map ----
// The ids of the first, 15-station catalog are kept, so stored stamps still resolve.
// The Mattapan Line counts with the Red Line here: the MBTA colours it red, and the
// passport files it on the Red Line's card.

const asLine = (l: TLineId): LineColor => (l === "mattapan" ? "red" : l);

export const STATIONS: Station[] = T_STATIONS.map((s) => ({
  id: s.id,
  name: s.name,
  short: s.short,
  lines: [...new Set(s.lines.map(asLine))],
  ...(s.branches ? { branches: [...s.branches] } : {}),
}));

const byId = new Map(STATIONS.map((s) => [s.id, s]));
export const stationById = (id: string) => byId.get(id);

const ids = (line: TLineId, branch?: TBranch) => stationsOn(line, branch).map((s) => s.id);
const only = (list: string[], not: string[]) => list.filter((id) => !not.includes(id));
const CENTRAL = ["gov-ctr", "park-st", "boylston", "arlington", "copley", "hynes", "kenmore"];
const NORTH = ["haymarket", "north-station", "science-park", "lechmere", "union-sq", "east-somerville", "gilman-sq", "magoun-sq", "ball-sq", "medford-tufts"];
const RED_TRUNK = ["alewife", "davis", "porter", "harvard", "central", "kendall-mit", "charles-mgh", "park-st", "downtown-crossing", "south-station", "broadway", "andrew", "jfk-umass"];

/** Passport layout: every station, in line order, grouped the way the map draws the line. */
export const PASSPORT_LAYOUT: Record<LineColor, { group: string; stationIds: string[] }[]> = {
  green: [
    { group: "CENTRAL SUBWAY", stationIds: CENTRAL },
    { group: "B · BOSTON COLLEGE", stationIds: only(ids("green", "B"), CENTRAL) },
    { group: "C · CLEVELAND CIRCLE", stationIds: only(ids("green", "C"), CENTRAL) },
    { group: "D · RIVERSIDE", stationIds: only(ids("green", "D"), [...CENTRAL, ...NORTH]) },
    { group: "E · HEATH ST", stationIds: only(ids("green", "E"), [...CENTRAL, ...NORTH]) },
    { group: "NORTH · UNION SQ AND MEDFORD", stationIds: NORTH },
  ],
  red: [
    { group: "ALEWIFE TO JFK/UMASS", stationIds: RED_TRUNK },
    { group: "ASHMONT", stationIds: only(ids("red"), RED_TRUNK).filter((id) => ["savin-hill", "fields-corner", "shawmut", "ashmont"].includes(id)) },
    { group: "BRAINTREE", stationIds: only(ids("red"), RED_TRUNK).filter((id) => !["savin-hill", "fields-corner", "shawmut", "ashmont"].includes(id)) },
    { group: "MATTAPAN LINE", stationIds: only(ids("mattapan"), ["ashmont"]) },
  ],
  orange: [{ group: "OAK GROVE TO FOREST HILLS", stationIds: ids("orange") }],
  blue: [{ group: "WONDERLAND TO BOWDOIN", stationIds: ids("blue") }],
};

/** Distinct stations on each line's passport card. */
export const LINE_STATION_COUNT: Record<LineColor, number> = Object.fromEntries(
  (Object.keys(PASSPORT_LAYOUT) as LineColor[]).map((l) => [l, new Set(PASSPORT_LAYOUT[l].flatMap((g) => g.stationIds)).size]),
) as Record<LineColor, number>;

/** Stops on each Green Line branch, end to end. */
export const BRANCH_STOP_COUNT: Record<GreenBranch, number> = { B: ids("green", "B").length, C: ids("green", "C").length, D: ids("green", "D").length, E: ids("green", "E").length };

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
  M({ id: "three-teal", group: "spot", rarity: "common", title: "Find 3 things in this car that are {color}.", body: "Point, don't walk off.", seconds: 90 }),
  M({ id: "oldest-thing", group: "spot", rarity: "common", title: "Spot the oldest thing in this car.", body: "Make your case.", seconds: 90 }),
  M({ id: "count-signs", group: "spot", rarity: "common", title: "Count the ads in this car.", body: "Closest guess first, then count.", seconds: 60 }),
  M({ id: "best-ad", group: "spot", rarity: "common", title: "Pick the best ad in this car.", body: "Then the worst.", seconds: 60 }),
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

/** Fill {station} / {name} / {color} placeholders in a mission title. */
export const missionText = (s: string, vars: { station?: string; name?: string; color?: string }) =>
  s
    .replace("{station}", vars.station ?? "the next stop")
    .replace("{name}", vars.name ?? "them")
    .replace("{color}", vars.color ?? "orange");

/** The demo trip (apps/worker/src/mbta/demo.ts): Green Line D inbound, cars 1413 (front) and 1412. */
export const DEMO_TRIP = {
  line: "green" as LineColor,
  branch: "D" as GreenBranch,
  cars: ["1413", "1412"],
  stops: [
    { id: "kenmore", name: "Kenmore" },
    { id: "hynes", name: "Hynes" },
    { id: "copley", name: "Copley" },
    { id: "arlington", name: "Arlington" },
    { id: "boylston", name: "Boylston" },
    { id: "park-st", name: "Park St" },
    { id: "gov-ctr", name: "Government Ctr" },
  ],
};
