// Every WebSocket message, both directions. Messages are JSON: { type, ...payload }.
// Rider sockets: /ws/rider?token=   (phone-web and glasses-web)
// Kiosk sockets: /ws/kiosk/:car?key=&role=screen|pi   (kiosk-web and kiosk-pi)
import { z } from "zod";
import { CarId, Mission, PairColor, Partner, RideState, Stamp } from "./models";

// ---------- server -> rider (phone + glasses) ----------

export const RideStateEvent = z.object({ type: z.literal("ride.state"), state: RideState });

export const MatchFoundEvent = z.object({
  type: z.literal("match.found"),
  matchId: z.string(),
  partner: Partner,
  why: z.string(),              // "You both love ramen and are riding to Park St"
  meetAtCar: CarId,             // whose kiosk to go to
  carDelta: z.number().int(),   // 0 same car, -1 one car back, +2 two cars forward
  youWalk: z.boolean(),         // false = stay put, they come to you
});

export const MatchClearedEvent = z.object({
  type: z.literal("match.cleared"),
  matchId: z.string(),
  reason: z.enum(["partner-not-now", "partner-left", "stop-reached", "mission-done", "ghost"]),
});

export const MissionStartEvent = z.object({ type: z.literal("mission.start"), mission: Mission });
export const MissionEndEvent = z.object({
  type: z.literal("mission.end"),
  sessionId: z.string(),
  reason: z.enum(["stamped", "time-up", "cancelled"]),
});
export const StampAwardedEvent = z.object({ type: z.literal("stamp.awarded"), stamp: Stamp });

export const ServerToRider = z.discriminatedUnion("type", [
  RideStateEvent,
  MatchFoundEvent,
  MatchClearedEvent,
  MissionStartEvent,
  MissionEndEvent,
  StampAwardedEvent,
]);
export type ServerToRider = z.infer<typeof ServerToRider>;

// ---------- rider -> server ----------

export const RiderToServer = z.discriminatedUnion("type", [
  z.object({ type: z.literal("rider.hello"), client: z.enum(["phone", "glasses"]) }),
  z.object({ type: z.literal("rider.notNow") }), // pinch on glasses: drop this match, 10 min cooldown
  z.object({ type: z.literal("rider.arrived") }), // optional "I'm at the kiosk" from glasses
  z.object({ type: z.literal("ping") }),
]);
export type RiderToServer = z.infer<typeof RiderToServer>;

// ---------- server -> kiosk (screen + pi) ----------

export const KioskIdleEvent = z.object({
  type: z.literal("kiosk.idle"),
  ridersInCar: z.number().int(),
  ridersOnTrain: z.number().int(),
  nextStop: z.string().nullable(),
  nextStopEtaSec: z.number().int().nullable(),
});

export const PairIncomingEvent = z.object({
  type: z.literal("pair.incoming"),
  matchId: z.string(),
  color: PairColor,
  firstNames: z.tuple([z.string(), z.string()]), // first names only, the screen is public
});

export const MissionShowEvent = z.object({
  type: z.literal("mission.show"),
  matchId: z.string(),
  color: PairColor,
  mission: Mission,
});

/** Pi only: write this URL to the NFC tag now. */
export const NfcWriteEvent = z.object({ type: z.literal("nfc.write"), url: z.string().url() });

export const CelebrateEvent = z.object({
  type: z.literal("celebrate"),
  matchId: z.string(),
  color: PairColor,
  rare: z.boolean(),
});

export const PairClearedEvent = z.object({ type: z.literal("pair.cleared"), matchId: z.string() });

export const ServerToKiosk = z.discriminatedUnion("type", [
  KioskIdleEvent,
  PairIncomingEvent,
  MissionShowEvent,
  NfcWriteEvent,
  CelebrateEvent,
  PairClearedEvent,
]);
export type ServerToKiosk = z.infer<typeof ServerToKiosk>;

// ---------- kiosk -> server ----------

export const KioskToServer = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("kiosk.hello"),
    car: CarId,
    role: z.enum(["screen", "pi"]),
    hw: z.object({ leds: z.boolean(), nfc: z.enum(["dynamic", "static", "none"]) }).optional(),
  }),
  z.object({ type: z.literal("nfc.written"), url: z.string().url() }), // Pi confirms the tag was rewritten
  z.object({ type: z.literal("ping") }),
]);
export type KioskToServer = z.infer<typeof KioskToServer>;
