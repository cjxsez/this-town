// The seam between the UI and the backend. The UI only calls these methods;
// api/index.ts picks the simulator (mock/) or the worker (backend/).
import type { Person, Profile, ReportReason, SocialBattery, Stamp } from "../../shared/types";
import type { TapBody, TapResult } from "../lib/api";
import type { ServerEvent } from "../state/ride";

export interface RideContext {
  profile: Profile;
  mood: SocialBattery;
  ghost: boolean;
}

/**
 * Realtime ride channel. Production: REST taps + a WebSocket to the train's room.
 * Everything that starts a ride, moves you between cars or stamps a mission comes from a
 * kiosk tag tap (`tapKiosk`), which the phone sends from /k/:car.
 */
export interface RideChannel {
  subscribe(fn: (e: ServerEvent) => void): () => void;
  /**
   * A tap on a kiosk tag. The first tap of a ride answers need-destination; the phone then
   * shows the destination picker and the Ride Mode confirmation, and taps again with
   * `destinationStop` and `rideMode: true`. Later taps move cars or stamp.
   */
  tapKiosk(body: TapBody, ctx: RideContext): Promise<TapResult>;
  /** Turn Ride Mode off. */
  checkOut(): void;
  setMood(mood: SocialBattery): void;
  setGhost(ghost: boolean): void;
  /** Drop the current match (10 min cooldown, the other rider gets rematched). */
  notNow(): void;
  /** "I'm here" at the meeting kiosk. Tapping its tag does the same. */
  arrived(): void;
}

/** What verifying an email code leads to. */
export type SignInResult =
  /** Existing account: this device now holds its token. */
  | { status: "signed-in"; profile: Profile }
  /** New email: onboard, and the rider is created as an account with this email. */
  | { status: "new-account"; email: string };

/** Email one-time-code sign-in. Errors are thrown with a message fit to show the rider. */
export interface AuthApi {
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<SignInResult>;
}

export interface QuestlineApi {
  auth: AuthApi;
  /** Create the rider (first call) or save edits. */
  saveProfile(p: Profile): Promise<void>;
  deleteMyData(): Promise<void>;
  /** The 4-digit code shown on the glasses. Rejects when the code is wrong or expired. */
  linkGlasses(code: string): Promise<void>;
  /** Stamps from the server, newest first. null when there's no server (mock). */
  loadPassport(): Promise<Stamp[] | null>;
  /** People you've been matched with, newest first. null when there's no server (mock). */
  loadPeople(): Promise<Person[] | null>;
  report(personId: string, reason: ReportReason, alsoBlock: boolean): Promise<void>;
  block(personId: string): Promise<void>;
  unblock(personId: string): Promise<void>;
  ride: RideChannel;
}
