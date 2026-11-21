// The ride state machine. The server owns matching and timing; the phone
// only renders whichever phase the server last put it in. Until the backend
// exists, api/mock/rideSim.ts plays the server and emits the same events.
import type {
  CheckIn,
  Match,
  MeetSpot,
  Mission,
  Offer,
  SocialBattery,
  Stamp,
} from "../../shared/types";

export type RidePhase =
  | "off" // C1: not checked in
  | "waiting" // C2 (C3 when offline): in the pool
  | "noMatch" // C4: train came, no quest
  | "offer" // D1 / D4 (offer.rare): private offer
  | "offerYes" // D2: you said yes, waiting on them
  | "fellThrough" // D3: skip, timeout, call-off: all look the same
  | "meet" // E1: go to the landmark
  | "cantSpot" // E2
  | "greeting" // E3: scripted password; met state starts here
  | "mission" // F1
  | "bump" // G1
  | "stamp" // G2: stamp + photo ask
  | "photo" // G3: both agreed, glasses take it
  | "keep" // G4: keep or delete
  | "recap"; // H1

export interface RideState {
  phase: RidePhase;
  checkIn?: CheckIn;
  /** Epoch ms the next train is due. Live MBTA data, counted down locally. */
  trainAt?: number;
  /** True while offline: the countdown is a local estimate, shown with "~". */
  online: boolean;
  delayed: boolean;
  delayMinutes?: number;
  mood: SocialBattery;
  offer?: Offer;
  match?: Match;
  meetSpot?: MeetSpot;
  /** Who speaks first and the scripted password exchange. */
  opener?: { youFirst: boolean; say: string; listenFor: string };
  youAtSpot: boolean;
  partnerAtSpotAt?: number;
  /** Glasses read the partner's badge (E3 "Badge read by your glasses"). */
  badgeVerified: boolean;
  metAt?: number;
  mission?: { mission: Mission; startedAt: number; endsAt: number; swapped: boolean };
  bump?: { deadline: number; you: boolean; partner: boolean };
  stamp?: Stamp;
  photo?: { you?: boolean; partner?: boolean; taken: boolean; keepDeadline?: number; youKeep?: boolean };
  /** F3 takeover: train in 30 s. Replaces whatever is showing. */
  trainSoon: boolean;
  /** Quest note, e.g. what they renamed the station. Optional one-tap note in H1. */
  note?: string;
  stampsThisRide: number;
  /** Pairs skipped this ride are never offered again this ride. */
  skippedThisRide: number;
}

export const initialRide: RideState = {
  phase: "off",
  online: true,
  delayed: false,
  mood: "chat",
  youAtSpot: false,
  badgeVerified: false,
  trainSoon: false,
  stampsThisRide: 0,
  skippedThisRide: 0,
};

/** Events the server (or the simulator) pushes to the phone. */
export type ServerEvent =
  | { type: "checkedIn"; checkIn: CheckIn; trainAt: number; delayed: boolean; delayMinutes?: number }
  | { type: "trainEta"; trainAt: number; delayed: boolean; delayMinutes?: number }
  | { type: "connection"; online: boolean }
  | { type: "offer"; offer: Offer }
  | { type: "cancelled" } // skip / timeout / partner withdrew / call-off: one neutral event
  | { type: "matched"; match: Match; meetSpot: MeetSpot; opener: RideState["opener"] }
  | { type: "partnerAtSpot"; at: number }
  | { type: "badgeVerified" }
  | { type: "missionAssigned"; mission: Mission; startedAt: number; endsAt: number; swapped: boolean }
  | { type: "partnerBumped" }
  | { type: "stampAwarded"; stamp: Stamp }
  | { type: "photoVotes"; you?: boolean; partner?: boolean }
  | { type: "photoTaken"; keepDeadline: number }
  | { type: "trainSoon" }
  | { type: "trainDeparted" }
  | { type: "ended" }; // server closed the quest; show recap

/** Optimistic local changes from the rider's own taps. */
export type LocalAction =
  | { type: "local/mood"; mood: SocialBattery }
  | { type: "local/offerYes" }
  | { type: "local/atSpot" }
  | { type: "local/cantSpot" }
  | { type: "local/backToMeet" }
  | { type: "local/met"; at: number }
  | { type: "local/missionDone"; bumpDeadline: number }
  | { type: "local/bump" }
  | { type: "local/photoVote"; yes: boolean }
  | { type: "local/keepVote"; keep: boolean }
  | { type: "local/note"; note: string }
  | { type: "local/dismissTrainSoon" }
  | { type: "local/dismiss" } // D3 "OK"
  | { type: "local/checkOut" }
  | { type: "local/finish" }; // leave recap

export type RideAction = ServerEvent | LocalAction;

const QUEST_PHASES: RidePhase[] = ["meet", "cantSpot", "greeting", "mission", "bump"];
const MET_PHASES: RidePhase[] = ["greeting", "mission", "bump"];

/** Clear per-quest fields when a quest ends or falls through. */
const clearQuest = (s: RideState): RideState => ({
  ...s,
  offer: undefined,
  match: undefined,
  meetSpot: undefined,
  opener: undefined,
  youAtSpot: false,
  partnerAtSpotAt: undefined,
  badgeVerified: false,
  metAt: undefined,
  mission: undefined,
  bump: undefined,
  stamp: undefined,
  photo: undefined,
  trainSoon: false,
  note: undefined,
});

export function rideReducer(s: RideState, a: RideAction): RideState {
  switch (a.type) {
    // ---- server ----
    case "checkedIn":
      return {
        ...clearQuest(s),
        phase: "waiting",
        checkIn: a.checkIn,
        trainAt: a.trainAt,
        delayed: a.delayed,
        delayMinutes: a.delayMinutes,
        online: true,
        skippedThisRide: 0,
      };
    case "trainEta":
      return { ...s, trainAt: a.trainAt, delayed: a.delayed, delayMinutes: a.delayMinutes };
    case "connection":
      // Offers that arrive while offline are dropped, not queued.
      if (!a.online && (s.phase === "offer" || s.phase === "offerYes")) {
        return { ...clearQuest(s), phase: "fellThrough", online: false };
      }
      return { ...s, online: a.online };
    case "offer":
      // Only one offer at a time, ever.
      if (s.phase !== "waiting" || !s.online) return s;
      return { ...s, phase: "offer", offer: a.offer };
    case "cancelled":
      if (s.phase === "offer" || s.phase === "offerYes" || s.phase === "meet" || s.phase === "cantSpot") {
        return { ...clearQuest(s), phase: "fellThrough", skippedThisRide: s.skippedThisRide + 1 };
      }
      return s;
    case "matched":
      if (s.phase !== "offerYes") return s;
      return { ...s, phase: "meet", match: a.match, meetSpot: a.meetSpot, opener: a.opener, offer: s.offer };
    case "partnerAtSpot":
      return { ...s, partnerAtSpotAt: a.at };
    case "badgeVerified":
      return { ...s, badgeVerified: true, phase: s.phase === "meet" || s.phase === "cantSpot" ? "greeting" : s.phase, metAt: s.metAt ?? Date.now() };
    case "missionAssigned":
      return { ...s, phase: "mission", mission: { mission: a.mission, startedAt: a.startedAt, endsAt: a.endsAt, swapped: a.swapped } };
    case "partnerBumped":
      return s.bump ? { ...s, bump: { ...s.bump, partner: true } } : s;
    case "stampAwarded":
      return { ...s, phase: s.phase === "bump" ? "stamp" : s.phase, stamp: a.stamp, stampsThisRide: s.stampsThisRide + 1, trainSoon: false };
    case "photoVotes": {
      const photo = { taken: false, ...s.photo, ...(a.you !== undefined && { you: a.you }), ...(a.partner !== undefined && { partner: a.partner }) };
      // "No thanks" from either side is invisible: the quest just moves on.
      if (photo.you === false || photo.partner === false) return { ...s, phase: "recap", photo: undefined };
      return { ...s, photo, phase: photo.you && photo.partner ? "photo" : s.phase };
    }
    case "photoTaken":
      return { ...s, phase: "keep", photo: { ...s.photo, taken: true, keepDeadline: a.keepDeadline } };
    case "trainSoon":
      return QUEST_PHASES.includes(s.phase) ? { ...s, trainSoon: true } : s;
    case "trainDeparted":
      if (s.phase === "waiting") return { ...s, phase: "noMatch", trainSoon: false };
      if (s.phase === "offer" || s.phase === "offerYes" || s.phase === "meet" || s.phase === "cantSpot")
        return { ...clearQuest(s), phase: "fellThrough" };
      // After the met state the quest still counts; recap lands on the train.
      if (MET_PHASES.includes(s.phase)) return { ...s, phase: s.stamp ? "recap" : s.phase, trainSoon: false };
      return { ...s, trainSoon: false };
    case "ended":
      return { ...s, phase: "recap", trainSoon: false };

    // ---- local ----
    case "local/mood":
      return { ...s, mood: a.mood };
    case "local/offerYes":
      return s.phase === "offer" ? { ...s, phase: "offerYes" } : s;
    case "local/cantSpot":
      return s.phase === "meet" ? { ...s, phase: "cantSpot" } : s;
    case "local/backToMeet":
      return s.phase === "cantSpot" ? { ...s, phase: "meet" } : s;
    case "local/atSpot":
      return { ...s, youAtSpot: true };
    case "local/met":
      return { ...s, phase: "greeting", metAt: a.at };
    case "local/missionDone":
      return { ...s, phase: "bump", bump: { deadline: a.bumpDeadline, you: false, partner: false }, trainSoon: false };
    case "local/bump":
      return s.bump ? { ...s, bump: { ...s.bump, you: true } } : s;
    case "local/photoVote":
      return rideReducer(s, { type: "photoVotes", you: a.yes });
    case "local/keepVote":
      return { ...s, photo: s.photo && { ...s.photo, youKeep: a.keep }, phase: "recap" };
    case "local/note":
      return { ...s, note: a.note };
    case "local/dismissTrainSoon":
      return { ...s, trainSoon: false };
    case "local/dismiss":
      return s.phase === "fellThrough" ? { ...s, phase: s.checkIn ? "waiting" : "off" } : s;
    case "local/checkOut":
      // checkIn is kept only to prefill C1 next time.
      return { ...clearQuest(s), phase: "off", trainAt: undefined, delayed: false, stampsThisRide: 0 };
    case "local/finish":
      // The recap lands on the train, so the ride is over; C4's "keep on" is the way to stay in.
      return { ...clearQuest(s), phase: "off", trainAt: undefined, delayed: false };
  }
}

/** True when the quest has reached the met state (greeting onward). */
export const hasMet = (s: RideState) => s.metAt !== undefined;
