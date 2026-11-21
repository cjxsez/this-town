/**
 * rooms/state.ts: the in-memory (and DO-storage-persisted) state of one TrainRoom.
 *
 * Responsible for:
 * - `RoomState`: everything a TrainRoom holds for its trip (architecture.md, "TrainRoom
 *   Durable Object"): checked-in riders, current pairs and their mission sessions, the trip's
 *   stops with current/next stop + ETA, delay. Plus bookkeeping: pair colors in use, kiosks'
 *   reported hardware, declined pairs, the per-pair "why" cache, and the demo clock.
 * - `TripInfo` / `TripTimeline`: what mbta/vehicles.ts and mbta/predictions.ts (or
 *   mbta/demo.ts) hand the room.
 * - `SocketAttachment`: what each hibernatable WebSocket carries (serializeAttachment), so
 *   the room knows who a socket belongs to after waking up.
 * - Tag helpers for ctx.acceptWebSocket / ctx.getWebSockets(tag).
 * - `offRideState()`: the RideState for someone not on this train.
 *
 * The whole RoomState is a single JSON value under storage key "state". It is small (tens
 * of riders), so we persist it whole on every change instead of row by row.
 *
 * Protocol types: CarId, InterestTag, Line, MissionCategory, PairColor, SocialBattery,
 * RideState.
 *
 * TODO:
 * - Bump `version` and write a migration in TrainRoom's constructor if the shape changes
 *   after deploy (old rooms keep old state until their trip ends).
 */
import type {
  CarId,
  InterestTag,
  Line,
  MissionCategory,
  PairColor,
  RideState,
  SocialBattery,
} from "@questline/protocol";
import type { CheckoutReason } from "../db/queries";

// ---------- trip + stops ----------

export interface TripInfo {
  tripId: string;
  line: Line;
  routeId: string;
  directionId: 0 | 1 | null;
  /** Car labels, front of the train first. carDelta > 0 means "forward". */
  carOrder: CarId[];
  demo: boolean;
}

export interface StopInfo {
  stopId: string;
  /** Parent station name, e.g. "Downtown Crossing". Destinations are stored by name. */
  name: string;
  sequence: number;
  /** Predicted arrival, epoch ms. Null for stops already passed or with no prediction. */
  etaMs: number | null;
}

export interface TripTimeline {
  stops: StopInfo[];
  /** Index into stops of the last stop reached, -1 before the first. */
  currentStopIdx: number;
  /** Index of the next stop, null at the end of the line. */
  nextStopIdx: number | null;
  nextStopEtaMs: number | null;
  /** Predicted minus scheduled, seconds. Drives the late-train bonus. */
  delaySec: number;
}

// ---------- riders ----------

export interface RiderProfileLite {
  firstName: string;
  interests: InterestTag[];
  askMeAbout: string;
  socialBattery: SocialBattery;
}

export interface RoomRider {
  // architecture.md fields
  userId: string;
  car: CarId;
  boardedStop: string;
  destinationStop: string;
  ghost: boolean;
  /** epoch ms; 0 when not cooling down. Set by rider.notNow (NOT_NOW_COOLDOWN_S). */
  notNowUntil: number;

  // bookkeeping
  checkinId: string;
  checkedInAt: number;
  profile: RiderProfileLite;
  /** Loaded from D1 at check-in: user ids met in the last 7 days. */
  metRecently: string[];
  /** Loaded from D1 at check-in: blocks in either direction. */
  blocked: string[];
  /** Loaded from D1 at check-in, appended on mission start: last 10 template ids. */
  recentTemplates: string[];
  /** After a mission, not matchable until state.nextStopIdx >= this ("next segment"). */
  eligibleFromStopIdx: number;
  /** matchId of the current pair, or null. */
  pairId: string | null;
}

/** Same values as checkins.checkout_reason. */
export type CheckOutReason = CheckoutReason;

export interface CheckInInput {
  userId: string;
  car: CarId;
  destinationStop: string;
  trip: TripInfo;
}

// ---------- pairs + missions ----------

export interface RoomPair {
  matchId: string;
  a: string;
  b: string;
  pairKey: string;
  color: PairColor;
  meetAtCar: CarId;
  /** userId of the rider who walks; null when both are in meetAtCar already. */
  walker: string | null;
  sharedTags: InterestTag[];
  why: string;
  createdAt: number;
  /** userIds that signalled arrival (rider.arrived, or tapped the meetAtCar tag). */
  arrived: string[];
  /** When to start the mission if nobody signals arrival. Null once started. */
  autoStartAt: number | null;
  /** Current mission session, if one is running. */
  sessionId: string | null;
}

export interface MissionSessionState {
  sessionId: string;
  matchId: string;
  templateId: string;
  category: MissionCategory;
  title: string;
  prompt: string;
  rare: boolean;
  car: CarId;
  startedAt: number;
  endsAt: number;
  /** Current tag nonce; null on static-tag kiosks (weaker proof accepted). */
  nonce: string | null;
  /** Set when the Pi confirms nfc.written for this nonce's URL. */
  nonceWrittenAt: number | null;
  /** userId -> epoch ms of a valid stamp tap. Stamp awarded when both present. */
  stampTaps: Record<string, number>;
}

// ---------- kiosks + sockets ----------

export type KioskRole = "screen" | "pi";

export interface KioskHw {
  leds: boolean;
  nfc: "dynamic" | "static" | "none";
}

export type RiderClient = "phone" | "glasses";

export type SocketAttachment =
  | { kind: "rider"; userId: string; client: RiderClient | null }
  | { kind: "kiosk"; car: CarId; role: KioskRole };

export const riderTag = (userId: string): string => `rider:${userId}`;
export const kioskTag = (car: CarId): string => `kiosk:${car}`;
export const kioskRoleTag = (car: CarId, role: KioskRole): string => `kiosk:${car}:${role}`;

export function tagsFor(att: SocketAttachment): string[] {
  return att.kind === "rider" ? [riderTag(att.userId)] : [kioskTag(att.car), kioskRoleTag(att.car, att.role)];
}

// ---------- demo ----------

export interface DemoClock {
  /** When the demo trip "departed" its first stop. */
  startedAt: number;
  /** Scripted delay added by POST /api/demo/delay. */
  delaySec: number;
  /** Time skipped by POST /api/demo/advance. */
  skipMs: number;
}

// ---------- the room ----------

export interface RoomState extends TripTimeline {
  version: 1;
  trip: TripInfo | null;
  riders: Record<string, RoomRider>;
  /** By matchId. */
  pairs: Record<string, RoomPair>;
  /** By sessionId. */
  missions: Record<string, MissionSessionState>;
  /** pairKeys where one side pressed "Not now" this trip; never re-paired on this trip. */
  declinedPairs: string[];
  /** pairKey -> why line. Cached per pair (architecture: "Cached per pair"). */
  whyCache: Record<string, string>;
  /** Last kiosk.hello hw per car. */
  kioskHw: Record<CarId, KioskHw>;
  lastPolledAt: number;
  demo: DemoClock | null;
}

export function emptyRoomState(): RoomState {
  return {
    version: 1,
    trip: null,
    riders: {},
    pairs: {},
    missions: {},
    stops: [],
    currentStopIdx: -1,
    nextStopIdx: null,
    nextStopEtaMs: null,
    delaySec: 0,
    declinedPairs: [],
    whyCache: {},
    kioskHw: {},
    lastPolledAt: 0,
    demo: null,
  };
}

export function offRideState(ghost = false): RideState {
  return {
    status: "off",
    tripId: null,
    line: null,
    car: null,
    destinationStop: null,
    nextStop: null,
    nextStopEtaSec: null,
    ridersOnTrain: 0,
    ghost,
  };
}
