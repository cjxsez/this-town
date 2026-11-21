// The seam between the UI and the backend. The UI only calls these methods;
// swap mock for http in api/index.ts when the Worker backend is wired.
import type { CheckIn, Profile, ReportReason, SocialBattery, StayInTouch } from "../../shared/types";
import type { ServerEvent } from "../state/ride";

export interface RideContext {
  profile: Profile;
  mood: SocialBattery;
  ghost: boolean;
}

/** Realtime ride channel. Production: a WebSocket to the station's Durable Object. */
export interface RideChannel {
  subscribe(fn: (e: ServerEvent) => void): () => void;
  checkIn(c: CheckIn, ctx: RideContext): void;
  checkOut(): void;
  setMood(mood: SocialBattery): void;
  setGhost(ghost: boolean): void;
  respondOffer(yes: boolean): void;
  /** "Never mind" (D2) and "Call it off" (E2). The other side just sees D3. */
  withdraw(): void;
  atSpot(): void;
  met(): void;
  startQuest(): void;
  newPrompt(): void;
  missionDone(): void;
  bump(): void;
  photoVote(yes: boolean): void;
  takePhoto(): void;
  keepVote(keep: boolean): void;
  /** F3 "I'm boarding": end now, stamp is held for the bump window. */
  board(): void;
  /** C4 "Keep on for the next station": ends the old ride, checks in at the next stop. */
  keepOnNextStation(): void;
}

export interface QuestlineApi {
  saveProfile(p: Profile): Promise<void>;
  deleteMyData(): Promise<void>;
  setStayInTouch(personId: string, on: boolean): Promise<StayInTouch>;
  report(personId: string, reason: ReportReason, alsoBlock: boolean): Promise<void>;
  block(personId: string): Promise<void>;
  unblock(personId: string): Promise<void>;
  voteMemory(memoryId: string, keep: boolean): Promise<void>;
  ride: RideChannel;
}
