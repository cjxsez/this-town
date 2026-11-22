// Translation between the worker's contract (@questline/protocol) and the shapes the screens
// use (shared/types.ts). The vocabularies are the same now (decision D14), so this is mostly
// renaming: interests, battery and rider kind pass straight through.
import { InterestTag } from "@questline/protocol";
import type {
  Line,
  MatchInfo,
  Mission as WireMission,
  Profile as WireProfile,
  RecentMatchesRes,
  RideState as WireRide,
  Stamp as WireStamp,
} from "@questline/protocol";
import { STATIONS, stationById } from "../../../shared/catalog";
import type {
  CheckIn,
  GreenBranch,
  LineColor,
  Match,
  Meet,
  Mission,
  MissionGroup,
  Person,
  Profile,
  ReportReason,
  Stamp,
} from "../../../shared/types";

/** The phone's interest ids are the protocol's InterestTag values; drop anything unknown. */
export function toInterestTags(interests: string[]): InterestTag[] {
  return interests.filter((id): id is InterestTag => InterestTag.safeParse(id).success).slice(0, 8);
}

/**
 * The worker's profile as the phone's, for a rider signing back in on a new device. They
 * accepted the Ride Mode rules when they made the account. glassesLinked starts false and
 * the Me tab refreshes it from GET /api/me.
 */
export function fromWireProfile(w: WireProfile, ids: { userId: string; email: string }): Profile {
  return {
    id: ids.userId,
    firstName: w.firstName,
    kind: w.status,
    is18: w.is18Plus,
    interests: [...w.interests],
    askMeAbout: w.askMeAbout || undefined,
    battery: w.socialBattery,
    rulesAccepted: true,
    glassesLinked: false,
    createdAt: new Date().toISOString(),
    email: ids.email,
  };
}

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

/** Fallback for a stop the worker sent without an id. */
export function stationIdFor(name: string | null | undefined): string {
  if (!name) return STATIONS[0]!.id;
  const n = norm(name);
  return STATIONS.find((s) => norm(s.name) === n || s.id === n)?.id ?? n;
}

const stationName = (id: string, fallback?: string | null) => stationById(id)?.name ?? fallback ?? id;

export function toCheckIn(state: WireRide): CheckIn {
  const { line, branch } = state.line ? fromLine(state.line) : { line: "green" as LineColor, branch: undefined };
  const nextId = state.nextStopId ?? stationIdFor(state.nextStop);
  const destId = state.destinationStopId ?? stationIdFor(state.destinationStop);
  return {
    car: state.car ?? "",
    line,
    branch,
    nextStationId: nextId,
    nextStationName: state.nextStop ?? stationName(nextId),
    destinationId: destId,
    destinationName: state.destinationStop ?? stationName(destId),
  };
}

export function toMatch(m: MatchInfo): Match {
  return {
    id: m.matchId,
    firstName: m.partner.firstName,
    color: m.partner.color,
    shared: m.partner.sharedTags,
    why: m.why,
    game: m.game,
  };
}

export function toMeet(m: MatchInfo): Meet {
  return { car: m.meetAtCar, carDelta: m.carDelta, youWalk: m.youWalk };
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
    stationName: w.station,
    ...fromLine(w.line),
    earnedAt: new Date(w.awardedAt).toISOString(),
    rare: w.rare,
    missionId: ctx.missionId ?? "",
    withPersonId: ctx.matchId ?? "",
    withFirstName: w.partnerFirstName,
  };
}

export function toPerson(m: RecentMatchesRes["matches"][number]): Person {
  return {
    id: m.matchId,
    firstName: m.partnerFirstName,
    color: m.color,
    metAtStationId: "",
    metAt: new Date(m.at).toISOString(),
    quests: m.stamped ? 1 : 0,
  };
}

export const REPORT_REASON: Record<ReportReason, string> = {
  uncomfortable: "Made me uncomfortable",
  didntStop: "Didn't stop when I said stop",
  other: "Something else",
};
