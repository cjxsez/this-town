// The ride state machine. The server owns matching and timing; the phone only renders
// whichever phase the server last put it in. api/mock/rideSim.ts plays the server in mock
// mode and emits the same events as the worker adapter (api/backend/ride.ts).
//
// The flow (docs/architecture.md):
//   off ──tap kiosk + confirm Ride Mode──▶ riding ──match──▶ meet ──tap meeting kiosk──▶ mission
//   mission ──both tap──▶ stamp ──▶ recap ──▶ riding (still on the train)
//   meet/mission ──Not now / partner left──▶ fellThrough ──▶ riding
//   any ──your stop / you turned it off──▶ rideOver ──▶ off
import type { CheckIn, Match, Meet, Mission, SocialBattery, Stamp } from "../../shared/types";

export type RidePhase =
  | "off" // C1: Ride Mode off. "Tap the kiosk in your car"
  | "riding" // C2 (C3 when offline): Ride Mode on, in the pool
  | "fellThrough" // D3: the match ended before the mission
  | "meet" // E1: go to the kiosk
  | "mission" // F1: playing; includes "tap the tag" and 1 of 2
  | "stamp" // G2
  | "recap" // H1
  | "rideOver"; // C4: Ride Mode turned off (your stop, or you)

export type FellThroughReason = "you" | "partner" | "other";
export type RideOverReason = "stop" | "you" | "tripEnded";

export interface RideState {
  phase: RidePhase;
  checkIn?: CheckIn;
  /** Epoch ms the train reaches the next stop. Counted down locally. */
  nextStopAt?: number;
  ridersOnTrain: number;
  online: boolean;
  delayed: boolean;
  delayMinutes?: number;
  mood: SocialBattery;
  match?: Match;
  meet?: Meet;
  /** You tapped the meeting kiosk (or said "I'm here"). */
  arrived: boolean;
  mission?: { mission: Mission; startedAt: number; endsAt: number };
  /** Stamp taps so far for this mission (0, 1, 2) and whether one of them was yours. */
  taps: number;
  youTapped: boolean;
  stamp?: Stamp;
  note?: string;
  fellThroughReason?: FellThroughReason;
  rideOverReason?: RideOverReason;
  stampsThisRide: number;
  peopleThisRide: number;
}

export const initialRide: RideState = {
  phase: "off",
  ridersOnTrain: 0,
  online: true,
  delayed: false,
  mood: "chat",
  arrived: false,
  taps: 0,
  youTapped: false,
  stampsThisRide: 0,
  peopleThisRide: 0,
};

/** Events the server (or the simulator) pushes to the phone. */
export type ServerEvent =
  | { type: "checkedIn"; checkIn: CheckIn; nextStopAt?: number; ridersOnTrain: number }
  | { type: "rideStatus"; checkIn?: CheckIn; nextStopAt?: number; ridersOnTrain: number; delayed: boolean; delayMinutes?: number }
  | { type: "connection"; online: boolean }
  | { type: "matched"; match: Match; meet: Meet }
  | { type: "cancelled"; reason: FellThroughReason }
  | { type: "arrived" }
  | { type: "missionAssigned"; mission: Mission; startedAt: number; endsAt: number }
  | { type: "stampProgress"; taps: number; you: boolean }
  | { type: "stampAwarded"; stamp: Stamp }
  /** Mission over without a stamp (time up). */
  | { type: "missionEnded" }
  | { type: "rideEnded"; reason: RideOverReason };

/** Optimistic local changes from the rider's own taps. */
export type LocalAction =
  | { type: "local/mood"; mood: SocialBattery }
  | { type: "local/note"; note: string }
  | { type: "local/dismiss" } // D3 "OK"
  | { type: "local/toRecap" } // G2 "Continue"
  | { type: "local/finish" } // leave the recap, back to riding
  | { type: "local/checkOut" } // you turned Ride Mode off
  | { type: "local/closeRideOver" };

export type RideAction = ServerEvent | LocalAction;

const QUEST_PHASES: RidePhase[] = ["meet", "mission", "stamp"];

/** Clear per-match fields when a match ends or falls through. */
const clearQuest = (s: RideState): RideState => ({
  ...s,
  match: undefined,
  meet: undefined,
  arrived: false,
  mission: undefined,
  taps: 0,
  youTapped: false,
  stamp: undefined,
  note: undefined,
});

export function rideReducer(s: RideState, a: RideAction): RideState {
  switch (a.type) {
    // ---- server ----
    case "checkedIn":
      return {
        ...clearQuest(s),
        phase: "riding",
        checkIn: a.checkIn,
        nextStopAt: a.nextStopAt,
        ridersOnTrain: a.ridersOnTrain,
        online: true,
        stampsThisRide: 0,
        peopleThisRide: 0,
        fellThroughReason: undefined,
        rideOverReason: undefined,
      };
    case "rideStatus":
      return {
        ...s,
        checkIn: a.checkIn ?? s.checkIn,
        nextStopAt: a.nextStopAt,
        ridersOnTrain: a.ridersOnTrain,
        delayed: a.delayed,
        delayMinutes: a.delayMinutes,
      };
    case "connection":
      return { ...s, online: a.online };
    case "matched":
      // Ride Mode is the consent, so a match goes straight to "go to the kiosk".
      if (s.phase !== "riding" && s.phase !== "fellThrough" && s.phase !== "meet") return s;
      return { ...clearQuest(s), phase: "meet", match: a.match, meet: a.meet, fellThroughReason: undefined };
    case "cancelled":
      if (s.phase === "meet" || s.phase === "mission") {
        return { ...clearQuest(s), phase: "fellThrough", fellThroughReason: a.reason };
      }
      return s;
    case "arrived":
      return { ...s, arrived: true };
    case "missionAssigned":
      return {
        ...s,
        phase: "mission",
        arrived: true,
        mission: { mission: a.mission, startedAt: a.startedAt, endsAt: a.endsAt },
        taps: 0,
        youTapped: false,
        peopleThisRide: s.mission ? s.peopleThisRide : s.peopleThisRide + 1,
      };
    case "stampProgress":
      return { ...s, taps: Math.max(s.taps, a.taps), youTapped: s.youTapped || a.you };
    case "stampAwarded":
      return {
        ...s,
        phase: QUEST_PHASES.includes(s.phase) ? "stamp" : s.phase,
        stamp: a.stamp,
        taps: 2,
        youTapped: true,
        stampsThisRide: s.stampsThisRide + 1,
      };
    case "missionEnded":
      return s.phase === "mission" ? { ...s, phase: "recap" } : s;
    case "rideEnded":
      if (s.phase === "off") return s;
      return { ...clearQuest(s), phase: "rideOver", rideOverReason: a.reason, nextStopAt: undefined };

    // ---- local ----
    case "local/mood":
      return { ...s, mood: a.mood };
    case "local/note":
      return { ...s, note: a.note };
    case "local/dismiss":
      return s.phase === "fellThrough" ? { ...s, phase: "riding", fellThroughReason: undefined } : s;
    case "local/toRecap":
      return s.phase === "stamp" ? { ...s, phase: "recap" } : s;
    case "local/finish":
      return s.phase === "recap" || s.phase === "stamp" ? { ...clearQuest(s), phase: "riding" } : s;
    case "local/checkOut":
      return { ...clearQuest(s), phase: "rideOver", rideOverReason: "you", nextStopAt: undefined };
    case "local/closeRideOver":
      return { ...initialRide, mood: s.mood, checkIn: s.checkIn };
  }
}

/** Ride Mode is on: checked in on a train, whatever the quest is doing. */
export const rideModeOn = (s: RideState) => s.phase !== "off" && s.phase !== "rideOver";
