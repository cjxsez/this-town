// Plays the server for the ride flow so the whole app can be demoed with no
// backend. Timings follow the wireframe: 25 s offer window, 20 s bump window,
// train countdown from "live MBTA data", one offer at a time.
import {
  DIRECTIONS,
  MEET_SPOTS,
  MISSIONS,
  PASSPORT_LAYOUT,
  badgeFor,
  interestById,
  stationById,
} from "../../../shared/catalog";
import type { CheckIn, Match, Mission, Offer, SocialBattery, Stamp } from "../../../shared/types";
import type { ServerEvent } from "../../state/ride";
import type { RideChannel, RideContext } from "../types";

const OFFER_WINDOW = 25_000;
const BUMP_WINDOW = 20_000;
const FIRST_TRAIN = 250_000;

type Listener = (e: ServerEvent) => void;

export interface DemoControls {
  /** Auto-play: an offer arrives a few seconds after checking in, partner says yes. */
  autoplay: boolean;
  forceOffer(rare?: boolean): void;
  partnerYes(): void;
  fallThrough(): void;
  partnerAtSpot(): void;
  verifyBadge(): void;
  setDelayed(delayed: boolean): void;
  setOnline(online: boolean): void;
  trainIn(seconds: number): void;
  departTrain(): void;
  partnerHasGlasses: boolean;
  /** Current sim flags, for the demo panel. */
  readonly delayed: boolean;
  readonly online: boolean;
}

export class RideSim implements RideChannel {
  private listeners = new Set<Listener>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private ctx?: RideContext;
  private checkInData?: CheckIn;
  private trainAt = 0;
  private delayed = false;
  private online = true;
  private ghost = false;
  private mood: SocialBattery = "chat";
  private phase: "idle" | "waiting" | "offer" | "yes" | "matched" | "met" | "mission" | "bump" | "stamp" = "idle";
  private offer?: Offer;
  private match?: Match;
  private mission?: Mission;
  private swapped = false;
  private recentMissions: string[] = [];
  private partnerBumpedFlag = false;
  private stampGiven = false;
  private trainSoonSent = false;
  private trainTimer?: ReturnType<typeof setTimeout>;
  private trainSoonTimer?: ReturnType<typeof setTimeout>;

  demo: DemoControls;

  constructor() {
    // Arrow functions keep `this` bound when the demo panel calls them loose.
    const sim = this;
    this.demo = {
      autoplay: true,
      partnerHasGlasses: true,
      forceOffer: (rare) => this.sendOffer(rare ?? this.delayed),
      partnerYes: () => this.partnerAccepts(),
      fallThrough: () => this.cancel(),
      partnerAtSpot: () => this.emit({ type: "partnerAtSpot", at: Date.now() }),
      verifyBadge: () => {
        if (this.phase === "matched") {
          this.phase = "met";
          this.emit({ type: "badgeVerified" });
        }
      },
      setDelayed: (d) => {
        this.delayed = d;
        if (this.checkInData) {
          // A delay pushes the train out; that is when rare quests appear.
          this.setTrain(d ? Math.max(this.trainAt, Date.now() + 9 * 60_000) : Date.now() + 4 * 60_000);
        }
      },
      setOnline: (o) => {
        this.online = o;
        if (!o && (this.phase === "offer" || this.phase === "yes")) this.phase = "waiting";
        this.emit({ type: "connection", online: o });
      },
      trainIn: (s) => this.setTrain(Date.now() + s * 1000),
      departTrain: () => this.trainArrives(),
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
    this.trainTimer = undefined;
    this.trainSoonTimer = undefined;
  }

  private setTrain(at: number) {
    this.trainAt = at;
    this.trainSoonSent = false;
    if (this.trainTimer) clearTimeout(this.trainTimer);
    if (this.trainSoonTimer) clearTimeout(this.trainSoonTimer);
    this.emit({ type: "trainEta", trainAt: at, delayed: this.delayed, delayMinutes: this.delayed ? 7 : undefined });
    const left = at - Date.now();
    this.trainSoonTimer = this.later(Math.max(0, left - 30_000), () => {
      this.trainSoonSent = true;
      this.emit({ type: "trainSoon" });
    });
    this.trainTimer = this.later(Math.max(0, left), () => this.trainArrives());
  }

  // ---- ride ----

  checkIn(c: CheckIn, ctx: RideContext) {
    this.clearAll();
    this.ctx = ctx;
    this.checkInData = c;
    this.mood = ctx.mood;
    this.ghost = ctx.ghost;
    this.phase = "waiting";
    this.recentMissions = [];
    this.trainAt = Date.now() + (this.delayed ? 9 * 60_000 : FIRST_TRAIN);
    this.emit({ type: "checkedIn", checkIn: c, trainAt: this.trainAt, delayed: this.delayed, delayMinutes: this.delayed ? 7 : undefined });
    this.setTrain(this.trainAt);
    this.scheduleAutoOffer();
  }

  checkOut() {
    this.clearAll();
    this.phase = "idle";
    this.checkInData = undefined;
  }

  setMood(m: SocialBattery) {
    this.mood = m;
  }

  setGhost(g: boolean) {
    this.ghost = g;
    if (!g) this.scheduleAutoOffer();
  }

  private scheduleAutoOffer() {
    if (!this.demo.autoplay) return;
    this.later(9000, () => {
      if (this.phase === "waiting" && !this.ghost) this.sendOffer(this.delayed);
    });
  }

  private sendOffer(rare: boolean) {
    if (this.phase !== "waiting" || !this.checkInData || this.ghost) return;
    const interest = this.sharedInterest();
    const why = rare
      ? `Someone here is also stuck and also likes ${interest}.`
      : `Someone here also loves ${interest}.`;
    this.offer = { id: `o-${Date.now()}`, why, minutes: rare ? 5 : this.mood === "nod" ? 2 : 3, rare, expiresAt: Date.now() + OFFER_WINDOW };
    this.phase = "offer";
    this.emit({ type: "offer", offer: this.offer });
    // Timing out looks identical to a skip from the other side.
    this.later(OFFER_WINDOW, () => {
      if (this.phase === "offer" || this.phase === "yes") this.cancel();
    });
  }

  /** The "why" line is a template from a shared chip, never AI-written. */
  private sharedInterest() {
    const mine = this.ctx?.profile.interests ?? [];
    const pick = mine.find((i) => i === "ramen") ?? mine[0] ?? "ramen";
    return interestById(pick)?.label ?? pick;
  }

  respondOffer(yes: boolean) {
    if (this.phase !== "offer") return;
    if (!yes) return this.cancel();
    this.phase = "yes";
    if (this.demo.autoplay) this.later(2600, () => this.partnerAccepts());
  }

  private partnerAccepts() {
    if (this.phase !== "yes" && this.phase !== "offer") return;
    if (this.phase === "offer") return; // they can't match until you've said yes
    const stationId = this.checkInData?.stationId ?? "kenmore";
    const spots = MEET_SPOTS[stationId] ?? MEET_SPOTS.kenmore;
    this.match = {
      id: "p-maya",
      firstName: "Maya",
      badge: badgeFor(17),
      pronoun: "she",
      askMeAbout: "the best bowl in Allston",
      hasGlasses: this.demo.partnerHasGlasses,
    };
    this.phase = "matched";
    this.emit({
      type: "matched",
      match: this.match,
      meetSpot: spots[0],
      opener: { youFirst: true, say: "Is this the train to Narnia?", listenFor: "Only on Tuesdays." },
    });
    if (this.demo.autoplay) {
      this.later(12_000, () => {
        if (this.phase === "matched") this.emit({ type: "partnerAtSpot", at: Date.now() });
      });
      // A glasses wearer's camera spots the partner's badge tag on its own.
      if (this.ctx?.profile.hasGlasses) this.later(6000, () => this.demo.verifyBadge());
    }
  }

  private cancel() {
    if (!["offer", "yes", "matched"].includes(this.phase)) return;
    this.phase = "waiting";
    this.offer = undefined;
    this.match = undefined;
    this.emit({ type: "cancelled" });
  }

  withdraw() {
    this.cancel();
  }

  atSpot() {
    // Sends the partner "<name> is at <spot>". Nothing else about location.
    if (this.demo.autoplay) this.later(1500, () => this.emit({ type: "partnerAtSpot", at: Date.now() - 20_000 }));
  }

  met() {
    if (this.phase === "matched") this.phase = "met";
  }

  private pickMission(): Mission {
    const left = (this.trainAt - Date.now()) / 1000;
    const pool = MISSIONS.filter((m) => {
      if (this.recentMissions.includes(m.id)) return false;
      if (m.delayOnly && !this.delayed) return false;
      if (this.mood === "nod" && !m.nodFriendly) return false;
      return m.seconds <= Math.max(45, left - 20);
    });
    const preferred = this.delayed
      ? pool.find((m) => m.delayOnly)
      : pool.find((m) => m.id === "rename-station") ?? pool.find((m) => m.group === "create");
    return preferred ?? pool[0] ?? MISSIONS[12];
  }

  startQuest() {
    if (this.phase !== "met" && this.phase !== "matched") return;
    this.phase = "mission";
    this.assignMission(false);
  }

  private assignMission(swapped: boolean) {
    this.mission = this.pickMission();
    this.recentMissions = [this.mission.id, ...this.recentMissions].slice(0, 10);
    const startedAt = Date.now();
    // The train always wins: never run past the train.
    const endsAt = Math.min(startedAt + this.mission.seconds * 1000, this.trainAt);
    this.swapped = swapped;
    this.emit({ type: "missionAssigned", mission: this.mission, startedAt, endsAt, swapped });
  }

  newPrompt() {
    if (this.phase !== "mission" || this.swapped) return; // one new prompt per quest
    this.assignMission(true);
  }

  missionDone() {
    this.phase = "bump";
    this.partnerBumpedFlag = false;
    this.stampGiven = false;
    this.later(BUMP_WINDOW, () => {
      // Both taps within 20 s or no stamp.
      if (this.phase === "bump" && !this.stampGiven) this.emit({ type: "ended" });
    });
    // Glasses can skip the tap: the camera sees both tags.
    if (this.ctx?.profile.hasGlasses && this.demo.autoplay) this.later(2500, () => this.bothBumped());
  }

  bump() {
    if (this.phase !== "bump") return;
    if (this.partnerBumpedFlag) return this.bothBumped();
    if (this.demo.autoplay) {
      this.later(1400, () => {
        this.partnerBumpedFlag = true;
        this.emit({ type: "partnerBumped" });
        this.bothBumped();
      });
    }
  }

  private bothBumped() {
    // Tapping twice never gives two stamps.
    if (this.stampGiven || !this.checkInData) return;
    this.stampGiven = true;
    this.phase = "stamp";
    this.emit({ type: "stampAwarded", stamp: this.makeStamp() });
  }

  private makeStamp(): Stamp {
    const c = this.checkInData!;
    return {
      id: `s-${c.stationId}-${Date.now()}`,
      stationId: c.stationId,
      line: c.line,
      branch: c.branch,
      earnedAt: new Date().toISOString(),
      rare: !!this.offer?.rare || !!this.mission?.delayOnly,
      delayNote: this.delayed ? "train was 7 min late" : undefined,
      missionId: this.mission?.id ?? "rename-station",
      withPersonId: this.match?.id ?? "p-maya",
    };
  }

  photoVote(yes: boolean) {
    if (!yes) return; // "No thanks" is invisible to the other side.
    if (this.demo.autoplay) this.later(1500, () => this.emit({ type: "photoVotes", partner: true }));
  }

  takePhoto() {
    // Auto-deletes in 24 h unless both keep it.
    this.later(900, () => this.emit({ type: "photoTaken", keepDeadline: Date.now() + 24 * 3600_000 - 60_000 }));
  }

  keepVote() {
    // The partner's vote arrives later (Memories shows "waiting on Maya").
  }

  board() {
    if (["met", "mission", "bump"].includes(this.phase) && !this.stampGiven && this.checkInData) {
      // The stamp is held for the bump window even if one of them boards.
      this.stampGiven = true;
      this.emit({ type: "stampAwarded", stamp: this.makeStamp() });
    }
    this.phase = "stamp";
    this.emit({ type: "ended" });
  }

  private trainArrives() {
    if (this.trainTimer) clearTimeout(this.trainTimer);
    if (["met", "mission", "bump"].includes(this.phase) && !this.stampGiven && this.checkInData) {
      this.stampGiven = true;
      this.emit({ type: "stampAwarded", stamp: this.makeStamp() });
    }
    if (!this.trainSoonSent) this.emit({ type: "trainSoon" });
    this.emit({ type: "trainDeparted" });
    if (this.phase === "waiting" || this.phase === "offer" || this.phase === "yes" || this.phase === "matched") {
      this.phase = "waiting";
    }
    this.clearAll();
  }

  keepOnNextStation() {
    const c = this.checkInData;
    if (!c || !this.ctx) return;
    // Re-check in at the next stop on the line; ends the old ride first.
    const order = PASSPORT_LAYOUT[c.line].flatMap((g) => g.stationIds);
    const i = order.indexOf(c.stationId);
    const westish = c.direction === "westbound" || c.direction === "outbound" || c.direction === "southbound";
    const nextId = order[i + (westish ? 1 : -1)] ?? order[0];
    const next = stationById(nextId) ?? stationById("kenmore")!;
    const dir = DIRECTIONS[c.line].find((d) => d.id === c.direction) ?? DIRECTIONS[c.line][0];
    this.checkIn({ ...c, stationId: next.id, direction: dir.id, via: "list" }, this.ctx);
  }
}
