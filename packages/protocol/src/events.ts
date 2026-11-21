// Every WebSocket message, both directions. Messages are JSON: { type, ...payload }.
// Rider sockets: /ws/rider?token=   (phone-web and glasses-web). Only open after check-in;
//   before that the worker closes with WS_CLOSE.noRide and clients poll GET /api/ride/state.
// Kiosk sockets: /ws/kiosk/:car?key=&role=screen|pi   (kiosk-web and kiosk-pi)
//
// Keepalive: clients send exactly WS_PING ('{"type":"ping"}') and get WS_PONG back
// (see colors.ts). It's answered by the DO's auto-response, so it never reaches handlers.
//
// Reconnect replay:
// - after rider.hello the worker sends ride.snapshot (state + current match + mission).
// - after kiosk.hello the worker sends kiosk.idle, then pair.incoming / mission.show for an
//   active pair, and (role=pi) nfc.write with the current tag URL.
//
// Times: every event that drives a countdown carries serverNow (epoch ms). Clients compute
// offset = serverNow - Date.now() and use it when rendering endsAt / ETAs.
import { z } from "zod";
import { CarId, MatchInfo, Mission, PairColor, RideSnapshot, RideState, Stamp } from "./models";

const ServerNow = z.number().int();

// ---------- server -> rider (phone + glasses) ----------

export const RideSnapshotEvent = z.object({ type: z.literal("ride.snapshot"), snapshot: RideSnapshot });

export const RideStateEvent = z.object({ type: z.literal("ride.state"), state: RideState, serverNow: ServerNow });

export const MatchFoundEvent = MatchInfo.extend({ type: z.literal("match.found") });

export const MatchClearedEvent = z.object({
  type: z.literal("match.cleared"),
  matchId: z.string(),
  reason: z.enum([
    "you-not-now",     // you pinched "Not now"
    "partner-not-now", // they did
    "partner-left",    // they checked out or moved out of reach
    "stop-reached",
    "mission-done",
    "ghost",
    "reported",
  ]),
});

export const MissionStartEvent = z.object({ type: z.literal("mission.start"), mission: Mission, serverNow: ServerNow });
export const MissionEndEvent = z.object({
  type: z.literal("mission.end"),
  sessionId: z.string(),
  reason: z.enum(["stamped", "time-up", "cancelled"]),
});

/** One of the two riders has tapped the tag with the current nonce. */
export const StampProgressEvent = z.object({
  type: z.literal("stamp.progress"),
  sessionId: z.string(),
  tapped: z.number().int().min(1).max(2),
});

export const StampAwardedEvent = z.object({ type: z.literal("stamp.awarded"), stamp: Stamp });

export const PongEvent = z.object({ type: z.literal("pong") });

export const ServerToRider = z.discriminatedUnion("type", [
  RideSnapshotEvent,
  RideStateEvent,
  MatchFoundEvent,
  MatchClearedEvent,
  MissionStartEvent,
  MissionEndEvent,
  StampProgressEvent,
  StampAwardedEvent,
  PongEvent,
]);
export type ServerToRider = z.infer<typeof ServerToRider>;

// ---------- rider -> server ----------
// The same actions exist as REST (POST /api/ride/not-now, /api/ride/arrived) for the polling fallback.

export const RiderToServer = z.discriminatedUnion("type", [
  z.object({ type: z.literal("rider.hello"), client: z.enum(["phone", "glasses"]) }),
  z.object({ type: z.literal("rider.notNow") }), // drop this match, cooldown NOT_NOW_COOLDOWN_S
  z.object({ type: z.literal("rider.arrived") }), // "I'm at the kiosk" (select gesture on the match card)
  z.object({ type: z.literal("ping") }),
]);
export type RiderToServer = z.infer<typeof RiderToServer>;

// ---------- server -> kiosk (screen + pi) ----------

/**
 * Periodic stats push (every alarm tick and on rider changes), not a "go idle" command.
 * Screens show the idle screen only when no pair is active at this kiosk.
 */
export const KioskIdleEvent = z.object({
  type: z.literal("kiosk.idle"),
  ridersInCar: z.number().int(),
  ridersOnTrain: z.number().int(),
  nextStop: z.string().nullable(),
  nextStopEtaSec: z.number().int().nullable(),
  serverNow: ServerNow,
});

/**
 * A pair is heading to this kiosk. A kiosk hosts at most one pair at a time (one tag, one screen);
 * the matcher treats a busy kiosk as unavailable.
 */
export const PairIncomingEvent = z.object({
  type: z.literal("pair.incoming"),
  matchId: z.string(),
  color: PairColor,
  firstNames: z.tuple([z.string(), z.string()]), // first names only, the screen is public
  arrived: z.number().int().min(0).max(2),        // how many have said "I'm here"
});

export const MissionShowEvent = z.object({
  type: z.literal("mission.show"),
  matchId: z.string(),
  color: PairColor,
  mission: Mission, // prompts must not contain interests: the screen is public
  serverNow: ServerNow,
});

export const KioskStampProgressEvent = z.object({
  type: z.literal("stamp.progress"),
  matchId: z.string(),
  tapped: z.number().int().min(1).max(2),
});

/** Pi only: write this URL to the NFC tag now, then reply nfc.written or nfc.failed with the same writeId. */
export const NfcWriteEvent = z.object({ type: z.literal("nfc.write"), writeId: z.string(), url: z.string().url() });

export const CelebrateEvent = z.object({
  type: z.literal("celebrate"),
  matchId: z.string(),
  color: PairColor,
  rare: z.boolean(), // use RARE_ACCENT_HEX on top of the pair color
});

/** Pair is done or gone (stamped, time up, not now, someone left). Back to idle. */
export const PairClearedEvent = z.object({ type: z.literal("pair.cleared"), matchId: z.string() });

export const ServerToKiosk = z.discriminatedUnion("type", [
  KioskIdleEvent,
  PairIncomingEvent,
  MissionShowEvent,
  KioskStampProgressEvent,
  NfcWriteEvent,
  CelebrateEvent,
  PairClearedEvent,
  PongEvent,
]);
export type ServerToKiosk = z.infer<typeof ServerToKiosk>;

// ---------- kiosk -> server ----------

export const KioskToServer = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("kiosk.hello"),
    car: CarId,
    role: z.enum(["screen", "pi"]),
    // Missing hw = { leds: false, nfc: "static" } (assume a sticker, no LEDs).
    hw: z.object({ leds: z.boolean(), nfc: z.enum(["dynamic", "static", "none"]) }).optional(),
  }),
  z.object({ type: z.literal("nfc.written"), writeId: z.string(), url: z.string().url() }),
  z.object({ type: z.literal("nfc.failed"), writeId: z.string(), reason: z.string() }),
  z.object({ type: z.literal("ping") }),
]);
export type KioskToServer = z.infer<typeof KioskToServer>;
