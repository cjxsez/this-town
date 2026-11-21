// Translation between the worker's contract (@questline/protocol) and the shapes the
// screens were designed around (shared/types.ts). Everything lossy or invented lives here
// so it is easy to find when the two vocabularies are unified.
import type {
  InterestTag,
  Line,
  MatchInfo,
  Mission as WireMission,
  PairColorName,
  Profile as WireProfile,
  RideState as WireRide,
  Stamp as WireStamp,
} from "@questline/protocol";
import { badgeFor, STATIONS } from "../../../shared/catalog";
import type {
  BadgeColor,
  CheckIn,
  GreenBranch,
  LineColor,
  Match,
  MeetSpot,
  Mission,
  MissionGroup,
  Profile,
  ReportReason,
  Stamp,
} from "../../../shared/types";
import type { RideState } from "../../state/ride";

/**
 * The design's 34 Boston-flavoured interests folded into the worker's 25 tags:
 * [closest tag, second closest]. Many map to the same tag, so the second is used to reach
 * the worker's minimum of three.
 */
const INTEREST_TAGS: Record<string, [InterestTag, InterestTag]> = {
  ramen: ["food", "cooking"],
  "red-sox": ["sports", "history"],
  thrifting: ["fashion", "design"],
  running: ["running", "sports"],
  "live-music": ["music", "art"],
  coffee: ["coffee", "food"],
  "board-games": ["gaming", "design"],
  museums: ["art", "history"],
  hiking: ["hiking", "travel"],
  anime: ["anime", "film"],
  photography: ["photography", "art"],
  cooking: ["cooking", "food"],
  dumplings: ["food", "cooking"],
  baking: ["cooking", "food"],
  cannoli: ["food", "travel"],
  celtics: ["sports", "gaming"],
  bruins: ["sports", "gaming"],
  soccer: ["sports", "running"],
  marathon: ["running", "sports"],
  theater: ["art", "writing"],
  comics: ["books", "art"],
  film: ["film", "photography"],
  climbing: ["climbing", "hiking"],
  cycling: ["sports", "travel"],
  rowing: ["sports", "running"],
  chess: ["gaming", "science"],
  "video-games": ["gaming", "tech"],
  trivia: ["gaming", "history"],
  ai: ["ai", "tech"],
  hackathons: ["tech", "startups"],
  robotics: ["tech", "science"],
  history: ["history", "books"],
  bookstores: ["books", "writing"],
  architecture: ["design", "history"],
};

/** Stopgap so onboarding never fails the worker's min-3 rule; only reached with under two picks. */
const FILLER_TAGS: InterestTag[] = ["food", "music", "coffee"];

export function toInterestTags(interests: string[]): InterestTag[] {
  const pairs = interests.map((id) => INTEREST_TAGS[id]).filter((p) => p !== undefined);
  const tags = new Set<InterestTag>(pairs.map((p) => p[0]));
  for (const p of pairs) if (tags.size < 3) tags.add(p[1]);
  for (const t of FILLER_TAGS) if (tags.size < 3) tags.add(t);
  return [...tags].slice(0, 5);
}

const BATTERY = { nod: "nod", chat: "quick-chat", talk: "lets-talk" } as const;
const STATUS = { local: "local", student: "student", visiting: "visitor" } as const;

/** Spots, handles, badge and the AI opt-in have no home in the worker's Profile yet. */
export function toWireProfile(p: Profile): WireProfile {
  return {
    firstName: p.firstName.slice(0, 24),
    interests: toInterestTags(p.interests),
    askMeAbout: (p.askMeAbout ?? "").slice(0, 80),
    socialBattery: BATTERY[p.battery],
    status: STATUS[p.kind],
    languages: [],
    is18Plus: true,
  };
}

export function fromLine(line: Line): { line: LineColor; branch?: GreenBranch } {
  if (line.startsWith("Green-")) return { line: "green", branch: line.slice(6) as GreenBranch };
  return { line: line.toLowerCase() as LineColor };
}

const norm = (s: string) =>
  s.toLowerCase().replace(/\bstreet\b/g, "st").replace(/\b(center|centre)\b/g, "ctr").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * The worker names stations ("Downtown Crossing"); the screens key them by catalog id.
 * A station missing from the catalog gets a slug id, and screens fall back to their default art.
 */
export function stationIdFor(name: string | null | undefined): string {
  if (!name) return STATIONS[0].id;
  const n = norm(name);
  return STATIONS.find((s) => norm(s.name) === n || s.id === n)?.id ?? n;
}

/** The train's next stop plays the part of the platform the rider checked in at. */
export function toCheckIn(state: WireRide): CheckIn {
  const { line, branch } = state.line ? fromLine(state.line) : { line: "green" as LineColor, branch: undefined };
  return {
    stationId: stationIdFor(state.nextStop),
    line,
    branch,
    direction: line === "green" ? "eastbound" : "inbound", // the worker does not send a direction
    via: "beacon",
  };
}

/** Pair colors the badge palette lacks borrow the nearest one. */
const BADGE_COLOR: Record<PairColorName, BadgeColor> = {
  orange: "orange",
  green: "teal",
  blue: "blue",
  pink: "red",
  yellow: "yellow",
  purple: "purple",
};

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * The worker has pair colors and kiosks, not animal badges (docs/decisions.md D7). The color
 * is real; the animal is only a stable avatar picked from the match id.
 */
export function toMatch(m: MatchInfo): Match {
  return {
    id: m.matchId,
    firstName: m.partner.firstName,
    badge: { ...badgeFor((hash(m.matchId) % 48) + 1), color: BADGE_COLOR[m.partner.color] },
    pronoun: "they",
    hasGlasses: false,
  };
}

export function toMeetSpot(m: MatchInfo): MeetSpot {
  const cars = Math.abs(m.carDelta);
  const where =
    cars === 0 ? "in your car" : `${cars} car${cars === 1 ? "" : "s"} toward the ${m.carDelta > 0 ? "front" : "back"}`;
  return {
    id: `kiosk-${m.meetAtCar}`,
    name: `The kiosk in car ${m.meetAtCar}`,
    detail: m.youWalk ? `${where}, glowing ${m.partner.color}` : `stay put, ${m.partner.firstName} is coming to you`,
  };
}

/** The worker has no password exchange; the kiosk color does that job, so the opener says so. */
export function toOpener(m: MatchInfo): NonNullable<RideState["opener"]> {
  return {
    youFirst: !m.youWalk,
    say: `Are you team ${m.partner.color}?`,
    listenFor: `Team ${m.partner.color}.`,
  };
}

const GROUP: Record<WireMission["category"], MissionGroup> = {
  create: "create",
  "show-me": "showMe",
  spot: "spot",
  "quick-game": "quickGame",
  "late-bonus": "lateBonus",
};

export function toMission(w: WireMission, now: number): Mission {
  return {
    id: w.templateId,
    group: GROUP[w.category],
    rarity: w.rare ? "rare" : "common",
    title: w.title,
    body: w.prompt,
    seconds: Math.max(0, Math.round((w.endsAt - now) / 1000)),
    delayOnly: w.category === "late-bonus",
  };
}

export function toStamp(w: WireStamp, ctx: { missionId?: string; matchId?: string }): Stamp {
  return {
    id: w.id,
    stationId: stationIdFor(w.station),
    ...fromLine(w.line),
    earnedAt: new Date(w.awardedAt).toISOString(),
    rare: w.rare,
    missionId: ctx.missionId ?? "",
    withPersonId: ctx.matchId ?? "",
  };
}

export const REPORT_REASON: Record<ReportReason, string> = {
  uncomfortable: "Made me uncomfortable",
  didntStop: "Didn't stop when I said stop",
  photoWithoutAsking: "Took a photo without asking",
  other: "Something else",
};
