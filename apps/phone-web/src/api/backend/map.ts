// Translation between the worker's contract (@questline/protocol) and the shapes the
// screens were designed around (shared/types.ts). Everything lossy or invented lives here
// so it is easy to find when the two vocabularies are unified.
import { InterestTag } from "@questline/protocol";
import type {
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

/** The phone's interest ids are the protocol's InterestTag values; drop anything unknown. */
export function toInterestTags(interests: string[]): InterestTag[] {
  return interests.filter((id): id is InterestTag => InterestTag.safeParse(id).success).slice(0, 8);
}

/** Spots, handles, badge and the AI opt-in have no home in the worker's Profile yet. */
export function toWireProfile(p: Profile): WireProfile {
  return {
    firstName: p.firstName.slice(0, 24),
    interests: toInterestTags(p.interests),
    askMeAbout: (p.askMeAbout ?? "").slice(0, 80),
    socialBattery: p.battery,
    status: p.kind,
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
    stationId: state.nextStopId ?? stationIdFor(state.nextStop),
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
    stationId: w.stationId || stationIdFor(w.station),
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
