// Plays the server for the ride flow so the whole app can be demoed with no backend.
// Same rules as the worker (apps/worker/src/rooms/TrainRoom.ts) on its demo trip:
// - the first tap of a ride needs a destination and Ride Mode confirmed (rideMode: true)
// - a match has no accept step: it goes straight to "go to the kiosk"
// - tapping the meeting kiosk's tag is arriving, which starts the mission
// - both riders tap the tag for the stamp; the mission ends 30 s before the next stop
// - you're checked out at your stop
import type { Line, RideState as WireRide, Stamp as WireStamp, TapRes } from "@questline/protocol";
import { DEMO_TRIP, MISSIONS, interestById, missionText } from "../../../shared/catalog";
import type { Match, Meet, Mission, PairColor, SocialBattery } from "../../../shared/types";
import type { TapBody } from "../../lib/api";
import type { ServerEvent } from "../../state/ride";
import type { RideChannel, RideContext } from "../types";

const SEGMENT_MS = 4 * 60_000;
const MATCH_AFTER_MS = 6_000;
const PARTNER_TAP_AFTER_MS = 4_000;
const MISSION_BUFFER_MS = 30_000;
const WIRE_LINE: Line = "Green-D";
const [FRONT_CAR, BACK_CAR] = DEMO_TRIP.cars as [string, string];

type Listener = (e: ServerEvent) => void;

export interface DemoControls {
  /** Auto-play: a match a few seconds after check-in, the partner taps for the stamp. */
  autoplay: boolean;
  matchNow(): void;
  partnerLeaves(): void;
  partnerTaps(): void;
  timeUp(): void;
  nextStop(): void;
  setDelayed(delayed: boolean): void;
  setOnline(online: boolean): void;
  /** Current sim flags, for the demo panel. */
  readonly delayed: boolean;
  readonly online: boolean;
}

/** The other riders the simulator matches you with, in order. Maya first, as in the demo script. */
const CAST: { firstName: string; color: PairColor }[] = [
  { firstName: "Maya", color: "orange" },
  { firstName: "Leo", color: "blue" },
  { firstName: "Priya", color: "pink" },
  { firstName: "Jonah", color: "green" },
  { firstName: "Ava", color: "purple" },
];

export class RideSim implements RideChannel {
  private listeners = new Set<Listener>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private ctx?: RideContext;
  private riding = false;
  private car = BACK_CAR;
  private destIdx = DEMO_TRIP.stops.length - 1;
  private stopIdx = 0;
  private nextStopAt = 0;
  private delayed = false;
  private online = true;
  private ghost = false;
  private lastDest: string | null = null;
  private match?: Match;
  private meet?: Meet;
  private notNowUntil = 0;
  /** Which of CAST the next match is: each match this ride is someone new. */
  private castIdx = 0;
  private mission?: { mission: Mission; endsAt: number; sessionId: string };
  private taps = new Set<"you" | "partner">();
  private stamped = false;
  private stopTimer?: ReturnType<typeof setTimeout>;
  private recent: string[] = [];

  demo: DemoControls;

  constructor() {
    const sim = this;
    this.demo = {
      autoplay: true,
      // The presenter's button: it overrides the 10-minute cooldown after "Not now", so a
      // demo that showed skipping can still show a match. Ghost mode still wins.
      matchNow: () => {
        this.notNowUntil = 0;
        this.makeMatch();
      },
      partnerLeaves: () => this.clearMatch("partner"),
      partnerTaps: () => this.tapStamp("partner"),
      timeUp: () => this.endMission(),
      nextStop: () => this.arriveAtStop(),
      setDelayed: (d) => {
        this.delayed = d;
        if (this.riding) this.setNextStop(d ? Math.max(this.nextStopAt, Date.now() + 9 * 60_000) : Date.now() + SEGMENT_MS);
      },
      setOnline: (o) => {
        this.online = o;
        this.emit({ type: "connection", online: o });
      },
      get delayed() {
        return sim.delayed;
      },
      get online() {
        return sim.online;
      },
    };
  }

  // ---- plumbing ----

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private emit(e: ServerEvent) {
    // While offline nothing reaches the phone except the reconnect itself.
    if (!this.online && e.type !== "connection") return;
    this.listeners.forEach((l) => l(e));
  }

  private later(ms: number, fn: () => void) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
    return t;
  }

  private clearAll() {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.stopTimer = undefined;
  }

  // ---- the train ----

  private stops() {
    return DEMO_TRIP.stops;
  }

  private nextIdx() {
    return Math.min(this.stopIdx + 1, this.stops().length - 1);
  }

  private wireState(): WireRide {
    const next = this.stops()[this.nextIdx()]!;
    const dest = this.stops()[this.destIdx]!;
    return {
      status: !this.match ? "riding" : this.mission ? "in-mission" : "matched",
      tripId: "demo-trip-1",
      line: WIRE_LINE,
      car: this.car,
      destinationStop: dest.name,
      destinationStopId: dest.id,
      nextStop: next.name,
      nextStopId: next.id,
      nextStopEtaSec: Math.max(0, Math.round((this.nextStopAt - Date.now()) / 1000)),
      ridersOnTrain: 4,
      ghost: this.ghost,
    };
  }

  private checkIn() {
    const next = this.stops()[this.nextIdx()]!;
    const dest = this.stops()[this.destIdx]!;
    return {
      car: this.car,
      line: DEMO_TRIP.line,
      branch: DEMO_TRIP.branch,
      nextStationId: next.id,
      nextStationName: next.name,
      destinationId: dest.id,
      destinationName: dest.name,
    };
  }

  private status() {
    this.emit({
      type: "rideStatus",
      checkIn: this.checkIn(),
      nextStopAt: this.nextStopAt,
      ridersOnTrain: 4,
      delayed: this.delayed,
      delayMinutes: this.delayed ? 7 : undefined,
    });
  }

  private setNextStop(at: number) {
    this.nextStopAt = at;
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.stopTimer = this.later(Math.max(0, at - Date.now()), () => this.arriveAtStop());
    if (this.mission && this.mission.endsAt > at - MISSION_BUFFER_MS) {
      this.later(Math.max(0, at - MISSION_BUFFER_MS - Date.now()), () => this.endMission());
    }
    this.status();
  }

  private arriveAtStop() {
    if (!this.riding) return;
    this.stopIdx = this.nextIdx();
    if (this.mission && !this.stamped) this.endMission();
    if (this.stopIdx >= this.destIdx) {
      this.end("stop");
      return;
    }
    this.setNextStop(Date.now() + SEGMENT_MS);
    if (this.demo.autoplay && !this.match) this.later(MATCH_AFTER_MS, () => this.makeMatch());
  }

  private end(reason: "stop" | "tripEnded") {
    this.clearAll();
    this.riding = false;
    this.match = this.meet = this.mission = undefined;
    this.emit({ type: "rideEnded", reason });
  }

  // ---- matching ----

  private makeMatch() {
    if (!this.riding || this.match || this.ghost || Date.now() < this.notNowUntil || !this.ctx) return;
    const mine = this.ctx.profile.interests;
    const who = CAST[this.castIdx % CAST.length]!;
    // each rider in the cast shares a different pair of your interests
    const shared = mine.length <= 2 ? mine.slice() : [mine[this.castIdx % mine.length]!, mine[(this.castIdx + 1) % mine.length]!];
    this.castIdx++;
    const labels = shared.map((id) => interestById(id)?.label ?? id);
    const youWalk = this.car !== FRONT_CAR;
    this.match = {
      id: `mat-${Date.now().toString(36)}`,
      firstName: who.firstName,
      color: who.color,
      shared,
      why: labels.length ? `You both like ${labels.join(" and ")}` : "You're riding the same train",
    };
    this.meet = { car: FRONT_CAR, carDelta: youWalk ? 1 : 0, youWalk };
    this.taps.clear();
    this.stamped = false;
    this.emit({ type: "matched", match: this.match, meet: this.meet });
    // Same car: nobody walks, the mission starts on its own soon.
    if (!youWalk) this.later(8_000, () => this.startMission());
  }

  private clearMatch(reason: "you" | "partner") {
    if (!this.match) return;
    this.match = this.meet = this.mission = undefined;
    this.emit({ type: "cancelled", reason });
    if (reason === "partner" && this.demo.autoplay) this.later(MATCH_AFTER_MS * 2, () => this.makeMatch());
  }

  private startMission() {
    if (!this.match || this.mission) return;
    const pool = MISSIONS.filter((m) => !!m.delayOnly === this.delayed && !this.recent.includes(m.id));
    const pick = pool[Math.floor(Math.random() * pool.length)] ?? MISSIONS[0]!;
    this.recent = [pick.id, ...this.recent].slice(0, 10);
    const station = this.stops()[this.nextIdx()]!.name;
    const mission: Mission = {
      ...pick,
      title: missionText(pick.title, { station, name: this.match.firstName, color: this.match.color }),
      body: missionText(pick.body, { station, name: this.match.firstName, color: this.match.color }),
    };
    const endsAt = Math.min(Date.now() + pick.seconds * 1000, this.nextStopAt - MISSION_BUFFER_MS);
    this.mission = { mission, endsAt, sessionId: `ses-${Date.now().toString(36)}` };
    this.emit({ type: "missionAssigned", mission, startedAt: Date.now(), endsAt });
    this.later(Math.max(1000, endsAt - Date.now()), () => this.endMission());
    if (this.demo.autoplay) this.later(Math.min(20_000, Math.max(2000, endsAt - Date.now() - 10_000)), () => this.tapStamp("partner"));
  }

  private endMission() {
    if (!this.mission || this.stamped) return;
    this.mission = undefined;
    this.match = this.meet = undefined;
    this.emit({ type: "missionEnded" });
  }

  private tapStamp(who: "you" | "partner"): WireStamp | null {
    if (!this.mission || this.stamped) return null;
    this.taps.add(who);
    if (this.taps.size < 2) {
      this.emit({ type: "stampProgress", taps: 1, you: who === "you" });
      if (who === "you" && this.demo.autoplay) this.later(PARTNER_TAP_AFTER_MS, () => this.tapStamp("partner"));
      return null;
    }
    this.stamped = true;
    const station = this.stops()[this.nextIdx()]!;
    const wire: WireStamp = {
      id: `stp-${Date.now().toString(36)}`,
      stationId: station.id,
      station: station.name,
      line: WIRE_LINE,
      partnerFirstName: this.match?.firstName ?? "",
      rare: this.mission.mission.rarity === "rare",
      awardedAt: Date.now(),
    };
    this.emit({
      type: "stampAwarded",
      stamp: {
        id: wire.id,
        stationId: station.id,
        stationName: station.name,
        line: DEMO_TRIP.line,
        branch: DEMO_TRIP.branch,
        earnedAt: new Date(wire.awardedAt).toISOString(),
        rare: wire.rare,
        delayNote: this.delayed ? "train was 7 min late" : undefined,
        missionId: this.mission.mission.id,
        withPersonId: this.match?.id ?? "",
        withFirstName: wire.partnerFirstName,
      },
    });
    this.mission = undefined;
    this.match = this.meet = undefined;
    return wire;
  }

  // ---- RideChannel ----

  async tapKiosk(body: TapBody, ctx: RideContext): Promise<TapRes> {
    this.ctx = ctx;
    this.ghost = ctx.ghost;
    if (!(body.car === FRONT_CAR || body.car === BACK_CAR)) {
      return { result: "error", message: `Car ${body.car} isn't on a live trip right now.` };
    }

    if (!this.riding) {
      const stops = this.stops().slice(this.nextIdx()).map((s) => ({ id: s.id, name: s.name }));
      const destIdx = this.stops().findIndex((s) => s.id === body.destinationStop);
      if (!body.rideMode || destIdx <= this.stopIdx) {
        return {
          result: "need-destination",
          line: WIRE_LINE,
          car: body.car,
          stops,
          suggestedStop: this.lastDest && stops.some((s) => s.id === this.lastDest) ? this.lastDest : null,
        };
      }
      this.riding = true;
      this.castIdx = 0;
      this.car = body.car;
      this.destIdx = destIdx;
      this.lastDest = body.destinationStop ?? null;
      this.nextStopAt = Date.now() + SEGMENT_MS;
      this.emit({ type: "checkedIn", checkIn: this.checkIn(), nextStopAt: this.nextStopAt, ridersOnTrain: 4 });
      this.setNextStop(this.nextStopAt);
      if (this.demo.autoplay) this.later(MATCH_AFTER_MS, () => this.makeMatch());
      return { result: "checked-in", state: this.wireState() };
    }

    // A tap on the meeting kiosk during a mission is a stamp tap.
    if (this.mission && body.car === this.meet?.car) {
      const stamp = this.tapStamp("you");
      return stamp ? { result: "stamp-awarded", stamp } : { result: "stamp-pending" };
    }

    const moved = body.car !== this.car;
    this.car = body.car;
    // Tapping the meeting kiosk before the mission is arriving.
    if (this.match && this.meet && body.car === this.meet.car) {
      this.meet = { ...this.meet, carDelta: 0 };
      this.emit({ type: "arrived" });
      this.later(1500, () => this.startMission());
    }
    this.status();
    return { result: moved ? "moved-car" : "checked-in", state: this.wireState() };
  }

  checkOut() {
    this.clearAll();
    this.riding = false;
    this.match = this.meet = this.mission = undefined;
    this.stopIdx = 0;
  }

  setMood(_mood: SocialBattery) {}

  setGhost(ghost: boolean) {
    this.ghost = ghost;
    if (ghost && this.match) this.clearMatch("you");
  }

  notNow() {
    if (!this.match) return;
    this.notNowUntil = Date.now() + 10 * 60_000;
    this.clearMatch("you");
  }

  arrived() {
    if (!this.match) return;
    this.emit({ type: "arrived" });
    this.later(1500, () => this.startMission());
  }
}
