/**
 * rooms/TrainRoom.ts: one Durable Object per MBTA trip_id. Live state + every socket on
 * that train.
 *
 * Who connects (WebSocket Hibernation API: ctx.acceptWebSocket, webSocketMessage,
 * webSocketClose; identity in serializeAttachment):
 * - riders' phones and glasses: /ws/rider?token=  (worker authenticates, then forwards here
 *   with x-questline-user). Tag rider:<userId>.
 * - every kiosk in the train, screen and Pi: /ws/kiosk/:car?key=&role=screen|pi. Tags
 *   kiosk:<car> and kiosk:<car>:<role>.
 *
 * In-memory state (RoomState in ./state.ts, persisted whole to DO storage key "state" on
 * every change, reloaded in the constructor after hibernation):
 * - checked-in riders: userId, car, boardedStop, destinationStop, ghost, notNowUntil
 *   (+ profile snapshot, met-recently / blocked lists, recent templates, pairId)
 * - current pairs (RoomPair) and their mission sessions (MissionSessionState)
 * - stops, current stop, next stop, ETA, delay (from MBTA, or mbta/demo.ts in DEMO_MODE)
 *
 * Alarm loop (alarm()): every ~20 s while anyone is checked in or a kiosk is connected, and
 * earlier when a deadline is due (mission autostart, mission end, next stop ETA):
 * - refresh the timeline (MBTA predictions or demo clock), advance stops
 * - check out riders whose destination was reached (match.cleared "stop-reached" to partner)
 * - end missions at nextStopEta - 30 s (mission.end "time-up")
 * - start missions whose autostart time passed
 * - run matching, push ride.state / kiosk.idle
 *
 * Matching runs whenever the rider set changes: check-in, check-out, move car, notNow,
 * ghost toggle, mission end, new segment.
 *
 * Events this room SENDS (packages/protocol/src/events.ts):
 *   to riders: ride.state, match.found, match.cleared, mission.start, mission.end, stamp.awarded
 *   to kiosks: kiosk.idle, pair.incoming, mission.show, nfc.write (pi only), celebrate, pair.cleared
 * Events this room RECEIVES:
 *   from riders: rider.hello, rider.notNow, rider.arrived, ping
 *   from kiosks: kiosk.hello, nfc.written, ping
 *
 * RPC methods (called by routes through rooms/stub.ts roomFor()):
 *   checkIn, moveCar, checkOut, notNow, stampTap, setGhost, snapshot, upcomingStops,
 *   clearForReport, demoTriggerDelay, demoAdvance, demoReset
 *
 * D1 writes from here: checkins (insert / car / close), matches (insert / end),
 * mission_sessions (insert / end), met_pairs (on mission start), stamps (on award).
 *
 * Kiosk screen is public: pair.incoming and mission.show carry first names, colors and the
 * mission prompt only. Never interests or the why line.
 *
 * Happy path (docs/architecture.md "Flow"):
 * 1. checkIn (first tap): load the rider from D1, insert a checkins row, add to the room,
 *    run matching.
 * 2. runMatching: pool -> gate (shared interests, not blocked/declined/met recently) ->
 *    closest car wins -> greedy pairs. Each pair gets a color, a "why" line, a meeting
 *    kiosk; both riders get match.found, the kiosk gets pair.incoming. No accept step.
 * 3. markArrived (tap on the meeting kiosk, rider.arrived, or autoStartAt in the alarm)
 *    starts the mission once the walker is there.
 * 4. startMission: pick from the deck to fit before the next stop minus 30 s, fresh nonce
 *    on dynamic tags, mission.start to riders, mission.show to the kiosk, nfc.write to the Pi.
 * 5. stampTap: first tap -> stamp.progress, second -> two stamps, celebrate, clear the pair.
 * 6. time-up / not now / ghost / check-out / report all end the mission and clear the pair.
 * 7. The alarm advances stops, checks riders out at their destination, ends missions on
 *    time, starts missions whose autostart is due, and rematches.
 *
 * Live MBTA timelines are not wired yet: only the demo trip (DEMO_MODE) has stops and ETAs.
 */
import { DurableObject } from "cloudflare:workers";
import {
  WS_CLOSE,
  WS_PING,
  WS_PONG,
  KioskToServer,
  RiderToServer,
  type CarId,
  type Mission,
  type Profile,
  type RideSnapshot,
  type RideState,
  type ServerToKiosk,
  type ServerToRider,
  type SocialBattery,
  type Stamp,
  type Stop,
} from "@questline/protocol";
import { readConfig, type Config, type Env } from "../env";
import {
  blockedEither,
  closeCheckin,
  endMatch,
  endMissionSession,
  getUser,
  insertCheckin,
  insertMatch,
  insertMissionSession,
  insertStamps,
  metSince,
  recentTemplatesForUser,
  recordMet,
  setUserGhost,
  templatesForPair,
  updateCheckinCar,
  type MatchEndReason,
} from "../db/queries";
import type { MatchPayload, TapResT } from "../lib/api";
import { newId, pairKey } from "../lib/ids";
import {
  ALARM_INTERVAL_MS,
  MET_RECENTLY_WINDOW_MS,
  MISSION_AUTOSTART_DELAY_MS,
  MISSION_END_BUFFER_MS,
  SECOND,
  STAMP_GRACE_MS,
  secondsUntil,
} from "../lib/time";
import { writeWhy } from "../llm/why";
import { advanceDemoClock, demoTimeline, newDemoClock } from "../mbta/demo";
import { assignColor, colorsInUse } from "../matching/colors";
import { carDelta, greedyPairs } from "../matching/pair";
import { openFreeRoom } from "./GameRoom";
import { buildPool, stopIndex } from "../matching/pool";
import { slotValuesFor, toMission } from "../missions/fill";
import { selectMission } from "../missions/select";
import { newNonce, nonceMatches, tagUrl } from "../nfc";
import { INTERNAL_HEADERS } from "./stub";
import {
  emptyRoomState,
  kioskRoleTag,
  kioskTag,
  offRideState,
  riderTag,
  tagsFor,
  type CheckInInput,
  type CheckOutReason,
  type KioskHw,
  type KioskRole,
  type MissionSessionState,
  type RoomPair,
  type RoomState,
  type SocketAttachment,
  type TripInfo,
} from "./state";

const STATE_KEY = "state";
/** How long the kiosk gets to celebrate before pair.cleared sends it back to idle. */
const CELEBRATE_MS = 6 * SECOND;
/** Longest a mission runs, even with a long segment ahead. */
const MAX_MISSION_SEC = 180;
const DEFAULT_KIOSK_HW: KioskHw = { leds: false, nfc: "static" };

type RiderAttachment = Extract<SocketAttachment, { kind: "rider" }>;
type KioskAttachment = Extract<SocketAttachment, { kind: "kiosk" }>;
type ClearReason = Extract<ServerToRider, { type: "match.cleared" }>["reason"];

export class TrainRoom extends DurableObject<Env> {
  private state: RoomState = emptyRoomState();
  private matchingRun: Promise<void> | null = null;
  private matchingAgain = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<RoomState>(STATE_KEY);
      if (saved) this.state = saved;
    });
    // Answer keepalives without waking the hibernated DO. Clients send exactly WS_PING.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(WS_PING, WS_PONG));
  }

  private get cfg(): Config {
    return readConfig(this.env);
  }

  // ======================================================================
  // WebSocket entry (forwarded by src/index.ts after auth)
  // ======================================================================

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const url = new URL(request.url);
    const att = attachmentFromRequest(url.pathname, request.headers);
    if (!att) return new Response("bad internal request", { status: 400 });

    const tripHeader = request.headers.get(INTERNAL_HEADERS.trip);
    if (tripHeader) await this.ensureTrip(JSON.parse(tripHeader) as TripInfo, Date.now());

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server, tagsFor(att));
    server.serializeAttachment(att);

    // Riders get their snapshot on rider.hello, kiosks their view on kiosk.hello.
    if (att.kind === "rider" && !this.state.riders[att.userId]) {
      server.close(WS_CLOSE.noRide, "not riding");
    }
    await this.scheduleAlarm(Date.now());
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    const att = ws.deserializeAttachment() as SocketAttachment | null;
    if (!att) return;
    let raw: unknown;
    try {
      raw = JSON.parse(message);
    } catch {
      return;
    }
    if (att.kind === "rider") {
      const parsed = RiderToServer.safeParse(raw);
      if (parsed.success) await this.onRiderMessage(ws, att, parsed.data);
    } else {
      const parsed = KioskToServer.safeParse(raw);
      if (parsed.success) await this.onKioskMessage(ws, att, parsed.data);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    // A closed socket never checks a rider out; check-out comes from the trip or /api/ride/end.
    try {
      ws.close(code, reason);
    } catch {
      // 1005/1006 cannot be echoed; the socket is already gone.
    }
  }

  async webSocketError(_ws: WebSocket, error: unknown): Promise<void> {
    console.warn("[TrainRoom] socket error", error);
  }

  private async onRiderMessage(ws: WebSocket, att: RiderAttachment, msg: RiderToServer): Promise<void> {
    switch (msg.type) {
      case "rider.hello":
        ws.serializeAttachment({ ...att, client: msg.client } satisfies RiderAttachment);
        send([ws], { type: "ride.snapshot", snapshot: this.snapshotFor(att.userId) });
        return;
      case "rider.notNow":
        await this.notNow(att.userId);
        return;
      case "rider.arrived":
        await this.markArrived(att.userId, Date.now());
        return;
      case "ping":
        return;
    }
  }

  private async onKioskMessage(ws: WebSocket, att: KioskAttachment, msg: KioskToServer): Promise<void> {
    switch (msg.type) {
      case "kiosk.hello":
        if (msg.car !== att.car) {
          ws.close(WS_CLOSE.forbidden, "car mismatch");
          return;
        }
        if (att.role === "pi") {
          this.state.kioskHw[att.car] = msg.hw ?? DEFAULT_KIOSK_HW;
          await this.persist();
        }
        this.replayToKiosk(ws, att.car, att.role);
        return;
      case "nfc.written": {
        const m = this.state.missions[msg.writeId];
        if (m) {
          m.nonceWrittenAt = Date.now();
          await this.persist();
        }
        return;
      }
      case "nfc.failed":
        console.warn(`[TrainRoom] kiosk ${att.car} could not write the tag: ${msg.reason}`);
        return;
      case "ping":
        return;
    }
  }

  // ======================================================================
  // RPC methods (routes -> room)
  // ======================================================================

  /** First tap of a ride on this trip. The route has validated destinationStop (a stop id). */
  async checkIn(input: CheckInInput): Promise<TapResT> {
    const now = Date.now();
    await this.ensureTrip(input.trip, now);
    const s = this.state;
    if (s.riders[input.userId]) return { result: "checked-in", state: this.rideStateFor(input.userId) };

    const user = await getUser(this.env.DB, input.userId);
    if (!user) return { result: "error", message: "We couldn't find your profile. Set it up again." };
    const destIdx = stopIndex(s, input.destinationStop);
    if (destIdx <= s.currentStopIdx) return { result: "error", message: "That stop is behind us." };

    const ignoreMet = this.cfg.demoMode;
    const [met, blocked, recent] = await Promise.all([
      ignoreMet ? Promise.resolve([]) : metSince(this.env.DB, input.userId, now - MET_RECENTLY_WINDOW_MS),
      blockedEither(this.env.DB, input.userId),
      recentTemplatesForUser(this.env.DB, input.userId),
    ]);
    const boarded = s.stops[Math.max(0, s.currentStopIdx)]?.stopId ?? input.destinationStop;
    const checkinId = newId("chk");
    await insertCheckin(this.env.DB, {
      id: checkinId,
      userId: input.userId,
      tripId: input.trip.tripId,
      line: input.trip.line,
      car: input.car,
      boardedStop: boarded,
      destinationStop: input.destinationStop,
      checkedInAt: now,
    });
    s.riders[input.userId] = {
      userId: input.userId,
      car: input.car,
      boardedStop: boarded,
      destinationStop: input.destinationStop,
      ghost: user.ghost,
      notNowUntil: 0,
      checkinId,
      checkedInAt: now,
      profile: {
        firstName: user.profile.firstName,
        interests: user.profile.interests,
        askMeAbout: user.profile.askMeAbout,
        socialBattery: user.profile.socialBattery,
      },
      metRecently: met,
      blocked,
      recentTemplates: recent,
      eligibleFromStopIdx: 0,
      pairId: null,
    };
    await this.persist();
    await this.runMatching(now);
    this.broadcastRideStates();
    this.broadcastKioskIdle();
    await this.scheduleAlarm(now);
    return { result: "checked-in", state: this.rideStateFor(input.userId) };
  }

  /** Tap on a different car's kiosk on the same trip. Counts as arrival if it is the meeting kiosk. */
  async moveCar(userId: string, car: CarId): Promise<TapResT> {
    const now = Date.now();
    const r = this.state.riders[userId];
    if (!r) return { result: "error", message: "You're not checked in on this train." };
    r.car = car;
    await updateCheckinCar(this.env.DB, r.checkinId, car);
    await this.persist();
    const pair = r.pairId ? this.state.pairs[r.pairId] : undefined;
    if (pair) {
      // Partner's carDelta/youWalk view doesn't change; ours does.
      const payload = this.matchPayloadFor(userId);
      if (payload) this.sendToRider(userId, { type: "match.found", ...payload });
      if (pair.meetAtCar === car) await this.markArrived(userId, now);
    } else {
      await this.runMatching(now);
    }
    this.broadcastRideStates();
    this.broadcastKioskIdle();
    await this.scheduleAlarm(now);
    return { result: "moved-car", state: this.rideStateFor(userId) };
  }

  async checkOut(userId: string, reason: CheckOutReason): Promise<void> {
    const now = Date.now();
    await this.checkOutInner(userId, reason, now);
    await this.persist();
    await this.runMatching(now);
    this.broadcastRideStates();
    this.broadcastKioskIdle();
    await this.scheduleAlarm(now);
  }

  /** rider.notNow from the glasses, or POST /api/ride/not-now from the phone. */
  async notNow(userId: string): Promise<void> {
    const now = Date.now();
    const r = this.state.riders[userId];
    if (!r?.pairId) return;
    const pair = this.state.pairs[r.pairId];
    if (!pair) return;
    r.notNowUntil = now + this.cfg.notNowCooldownSec * SECOND;
    this.state.declinedPairs.push(pair.pairKey);
    await this.clearPair(pair.matchId, "partner-not-now", now, { [userId]: "you-not-now" }, "partner-not-now");
    await this.persist();
    await this.runMatching(now);
    this.broadcastRideStates();
    this.broadcastKioskIdle();
    await this.scheduleAlarm(now);
  }

  /**
   * A tap at `car` by a checked-in rider. Returns null when it is not a stamp attempt, so the
   * route falls through to move-car / "already checked in". A tap on your own meeting kiosk
   * before the mission starts counts as arriving.
   */
  async stampTap(input: { userId: string; car: CarId; nonce?: string }): Promise<TapResT | null> {
    const now = Date.now();
    const r = this.state.riders[input.userId];
    const pair = r?.pairId ? this.state.pairs[r.pairId] : undefined;
    if (!r || !pair) return null;
    if (!pair.sessionId) {
      if (pair.meetAtCar === input.car) {
        if (r.car !== input.car) return null; // moveCar handles it, then marks arrival
        await this.markArrived(input.userId, now);
      }
      return null;
    }
    const m = this.state.missions[pair.sessionId];
    if (!m || m.car !== input.car) return null;
    if (now > m.endsAt + STAMP_GRACE_MS) return { result: "error", message: "That mission already ended." };
    if (m.nonce && !nonceMatches(m.nonce, input.nonce)) {
      return { result: "error", message: "The tag just changed. Tap it again." };
    }
    m.stampTaps[input.userId] = now;
    const tapped = Object.keys(m.stampTaps).length;
    if (tapped < 2) {
      await this.persist();
      for (const uid of [pair.a, pair.b]) this.sendToRider(uid, { type: "stamp.progress", sessionId: m.sessionId, tapped });
      this.sendToKiosks(m.car, { type: "stamp.progress", matchId: pair.matchId, tapped });
      return { result: "stamp-pending" };
    }
    const stamps = await this.awardStamps(pair, m, now);
    await this.persist();
    await this.scheduleAlarm(now);
    const mine = stamps[input.userId];
    return mine ? { result: "stamp-awarded", stamp: mine } : { result: "stamp-pending" };
  }

  async setGhost(userId: string, ghost: boolean): Promise<RideState> {
    const now = Date.now();
    const r = this.state.riders[userId];
    await setUserGhost(this.env.DB, userId, ghost);
    if (!r) return offRideState(ghost);
    r.ghost = ghost;
    if (ghost && r.pairId) await this.clearPair(r.pairId, "partner-left", now, { [userId]: "ghost" }, "ghost");
    await this.persist();
    await this.runMatching(now);
    this.broadcastRideStates();
    this.broadcastKioskIdle();
    await this.scheduleAlarm(now);
    return this.rideStateFor(userId);
  }

  /** POST /api/ride/mood: new social battery for matching from now on. */
  async setMood(userId: string, mood: SocialBattery): Promise<void> {
    const r = this.state.riders[userId];
    if (!r) return;
    r.profile.socialBattery = mood;
    await this.persist();
  }

  /** PATCH /api/me while riding: matching and the kiosk use the new name and interests. */
  async updateRiderProfile(userId: string, p: Profile): Promise<void> {
    const r = this.state.riders[userId];
    if (!r) return;
    r.profile = { firstName: p.firstName, interests: p.interests, askMeAbout: p.askMeAbout, socialBattery: p.socialBattery };
    await this.persist();
    await this.runMatching(Date.now());
    this.broadcastRideStates();
    await this.scheduleAlarm(Date.now());
  }

  /** GET /api/ride/state: the same snapshot riders get after rider.hello. */
  async snapshot(userId: string): Promise<RideSnapshot> {
    return this.snapshotFor(userId);
  }

  /** Stops a rider can pick as destination: the next stop onward. */
  async upcomingStops(trip: TripInfo): Promise<Stop[]> {
    await this.ensureTrip(trip, Date.now());
    const from = this.state.nextStopIdx ?? this.state.stops.length;
    return this.state.stops.slice(from).map((s) => ({ id: s.stopId, name: s.name }));
  }

  /** POST /api/report while the match is live: end it now. */
  async clearForReport(matchId: string, reporterId: string): Promise<void> {
    const now = Date.now();
    if (!this.state.pairs[matchId]) return;
    await this.clearPair(matchId, "reported", now, { [reporterId]: "reported" }, "reported");
    await this.persist();
    await this.runMatching(now);
    this.broadcastRideStates();
    this.broadcastKioskIdle();
    await this.scheduleAlarm(now);
  }

  async demoTriggerDelay(seconds: number): Promise<void> {
    if (!this.state.demo) return;
    this.state.demo.delaySec += seconds;
    await this.tick(Date.now());
    await this.scheduleAlarm(Date.now());
  }

  async demoAdvance(): Promise<void> {
    if (!this.state.demo) return;
    this.state.demo = advanceDemoClock(this.state.demo, Date.now());
    await this.tick(Date.now());
    await this.scheduleAlarm(Date.now());
  }

  async demoReset(): Promise<void> {
    const now = Date.now();
    for (const userId of Object.keys(this.state.riders)) await this.checkOutInner(userId, "trip-ended", now);
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      try {
        if (att?.kind === "kiosk") ws.close(WS_CLOSE.tripChanged, "trip reset");
      } catch {
        // already closed
      }
    }
    this.state = emptyRoomState();
    await this.persist();
    await this.ctx.storage.deleteAlarm();
  }

  // ======================================================================
  // Alarm loop
  // ======================================================================

  async alarm(): Promise<void> {
    await this.tick(Date.now());
    await this.scheduleAlarm(Date.now());
  }

  private async tick(now: number): Promise<void> {
    const s = this.state;
    if (!s.trip) return;
    const before = s.currentStopIdx;
    this.refreshTimeline(now);

    // Riders whose stop was reached get off.
    if (s.currentStopIdx !== before) {
      for (const r of Object.values(s.riders)) {
        if (stopIndex(s, r.destinationStop) <= s.currentStopIdx) await this.checkOutInner(r.userId, "destination", now);
      }
    }
    // End of the line: everyone off.
    if (s.nextStopIdx === null) {
      for (const userId of Object.keys(s.riders)) await this.checkOutInner(userId, "trip-ended", now);
    }
    // Missions out of time.
    for (const m of Object.values(s.missions)) {
      if (now >= m.endsAt) await this.finishMission(m.sessionId, "time-up", now);
    }
    // Missions whose autostart is due.
    for (const p of Object.values(s.pairs)) {
      if (p.sessionId === null && p.autoStartAt !== null && p.autoStartAt <= now) await this.startMission(p.matchId, now);
    }
    // Held-back pair.cleared for kiosks that were celebrating.
    const due = (s.pendingKioskClears ?? []).filter((c) => c.at <= now);
    if (due.length > 0) {
      s.pendingKioskClears = (s.pendingKioskClears ?? []).filter((c) => c.at > now);
      for (const c of due) this.sendToKiosks(c.car, { type: "pair.cleared", matchId: c.matchId });
    }

    await this.persist();
    await this.runMatching(now);
    this.broadcastRideStates();
    this.broadcastKioskIdle();
  }

  private async scheduleAlarm(now: number): Promise<void> {
    const s = this.state;
    const deadlines: number[] = [];
    if (Object.keys(s.riders).length > 0 || this.ctx.getWebSockets().length > 0) deadlines.push(now + ALARM_INTERVAL_MS);
    for (const p of Object.values(s.pairs)) if (p.autoStartAt !== null) deadlines.push(p.autoStartAt);
    for (const m of Object.values(s.missions)) deadlines.push(m.endsAt);
    for (const c of s.pendingKioskClears ?? []) deadlines.push(c.at);
    if (s.nextStopEtaMs !== null && deadlines.length > 0) deadlines.push(s.nextStopEtaMs);
    if (deadlines.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(Math.max(now + SECOND, Math.min(...deadlines)));
  }

  /** Demo clock for demo trips. Live MBTA predictions are not wired yet (mbta/predictions.ts). */
  private refreshTimeline(now: number): void {
    const s = this.state;
    if (s.trip?.demo && s.demo) Object.assign(s, demoTimeline(s.demo, now));
    s.lastPolledAt = now;
  }

  // ======================================================================
  // Matching + missions
  // ======================================================================

  /** Serialized: a run in flight (it awaits the why line) picks up changes with one more pass. */
  private async runMatching(now: number): Promise<void> {
    if (this.matchingRun) {
      this.matchingAgain = true;
      return this.matchingRun;
    }
    this.matchingRun = (async () => {
      do {
        this.matchingAgain = false;
        await this.matchOnce(now);
      } while (this.matchingAgain);
    })();
    try {
      await this.matchingRun;
    } finally {
      this.matchingRun = null;
    }
  }

  private async matchOnce(now: number): Promise<void> {
    const s = this.state;
    if (!s.trip) return;
    const proposals = greedyPairs(buildPool(s, now), s, {
      minSharedTags: this.cfg.minSharedTags,
      ignoreMetRecently: this.cfg.demoMode,
    });
    for (const p of proposals) {
      // Someone may have left or been paired while we awaited a why line.
      if (!s.riders[p.a.userId] || !s.riders[p.b.userId] || p.a.pairId || p.b.pairId) continue;
      const color = assignColor(colorsInUse(s));
      if (!color) return; // every color is in use on this train
      const key = pairKey(p.a.userId, p.b.userId);
      const why =
        s.whyCache[key] ??
        (await writeWhy(this.env, {
          a: { firstName: p.a.profile.firstName, askMeAbout: p.a.profile.askMeAbout },
          b: { firstName: p.b.profile.firstName, askMeAbout: p.b.profile.askMeAbout },
          sharedTags: p.sharedTags,
        }));
      s.whyCache[key] = why;
      if (!s.riders[p.a.userId] || !s.riders[p.b.userId] || p.a.pairId || p.b.pairId) continue;

      // A game room for the pair, so their phones can open the two-player games without a code.
      const gameCode = (await openFreeRoom(this.env).catch(() => null)) ?? undefined;
      if (!s.riders[p.a.userId] || !s.riders[p.b.userId] || p.a.pairId || p.b.pairId) continue;

      const matchId = newId("mat");
      const pair: RoomPair = {
        matchId,
        a: p.a.userId,
        b: p.b.userId,
        pairKey: key,
        color,
        meetAtCar: p.meetAtCar,
        walker: p.walker,
        sharedTags: p.sharedTags,
        why,
        createdAt: now,
        arrived: [],
        autoStartAt: now + MISSION_AUTOSTART_DELAY_MS,
        sessionId: null,
        gameCode,
      };
      s.pairs[matchId] = pair;
      p.a.pairId = matchId;
      p.b.pairId = matchId;
      await insertMatch(this.env.DB, {
        id: matchId,
        tripId: s.trip.tripId,
        line: s.trip.line,
        userA: pair.a,
        userB: pair.b,
        pairKey: key,
        color,
        meetAtCar: pair.meetAtCar,
        walkerId: pair.walker,
        sharedTags: pair.sharedTags,
        why,
        createdAt: now,
      });
      await this.persist();
      for (const uid of [pair.a, pair.b]) {
        const payload = this.matchPayloadFor(uid);
        if (payload) this.sendToRider(uid, { type: "match.found", ...payload });
        this.sendRideState(uid);
      }
      this.sendToKiosks(pair.meetAtCar, this.pairIncoming(pair));
    }
  }

  /** rider.arrived (glasses or POST /api/ride/arrived), or a tap on the meeting kiosk. */
  async markArrived(userId: string, now: number): Promise<void> {
    const r = this.state.riders[userId];
    const pair = r?.pairId ? this.state.pairs[r.pairId] : undefined;
    if (!r || !pair || pair.sessionId) return;
    if (!pair.arrived.includes(userId)) pair.arrived.push(userId);
    this.sendToKiosks(pair.meetAtCar, this.pairIncoming(pair));
    const walkerHere = pair.walker === null ? pair.arrived.length > 0 : pair.arrived.includes(pair.walker);
    if (walkerHere) await this.startMission(pair.matchId, now);
    await this.persist();
    await this.scheduleAlarm(now);
  }

  private async startMission(matchId: string, now: number): Promise<void> {
    const s = this.state;
    const pair = s.pairs[matchId];
    if (!pair || pair.sessionId || !s.trip) return;
    const etaMs = s.nextStopEtaMs;
    const availableSec = etaMs === null ? 0 : Math.floor((etaMs - MISSION_END_BUFFER_MS - now) / SECOND);
    const template = selectMission({
      availableSec,
      lateBonusUnlocked: s.delaySec >= this.cfg.lateBonusMinDelaySec,
      userHistories: [s.riders[pair.a]?.recentTemplates ?? [], s.riders[pair.b]?.recentTemplates ?? []],
      pairHistory: await templatesForPair(this.env.DB, pair.pairKey),
    });
    if (!template || etaMs === null) {
      // Not enough time before the next stop: try again just after it.
      pair.autoStartAt = etaMs === null ? null : etaMs + 5 * SECOND;
      await this.persist();
      return;
    }

    const durationSec = Math.min(Math.max(template.minSeconds, availableSec), MAX_MISSION_SEC);
    const endsAt = now + durationSec * SECOND;
    const sessionId = newId("ses");
    const hw = s.kioskHw[pair.meetAtCar] ?? DEFAULT_KIOSK_HW;
    const nonce = hw.nfc === "dynamic" ? newNonce() : null;
    const mission = toMission(template, slotValuesFor(s, pair.color), sessionId, endsAt);
    const station = s.stops[s.nextStopIdx ?? s.currentStopIdx];

    s.missions[sessionId] = {
      sessionId,
      matchId,
      templateId: template.id,
      category: template.category,
      title: mission.title,
      prompt: mission.prompt,
      rare: template.rare,
      car: pair.meetAtCar,
      startedAt: now,
      endsAt,
      nonce,
      nonceWrittenAt: null,
      stampTaps: {},
    };
    pair.sessionId = sessionId;
    pair.autoStartAt = null;
    for (const uid of [pair.a, pair.b]) s.riders[uid]?.recentTemplates.unshift(template.id);

    await insertMissionSession(this.env.DB, {
      id: sessionId,
      matchId,
      pairKey: pair.pairKey,
      templateId: template.id,
      category: template.category,
      rare: template.rare,
      car: pair.meetAtCar,
      station: station?.stopId ?? null,
      startedAt: now,
      endsAt,
    });
    await recordMet(this.env.DB, pair.a, pair.b, now);
    await this.persist();

    for (const uid of [pair.a, pair.b]) {
      this.sendToRider(uid, { type: "mission.start", mission, serverNow: now });
      this.sendRideState(uid);
    }
    this.sendToKiosks(pair.meetAtCar, { type: "mission.show", matchId, color: pair.color, mission, serverNow: now });
    if (nonce) {
      this.sendToKiosks(
        pair.meetAtCar,
        { type: "nfc.write", writeId: sessionId, url: tagUrl(this.cfg.publicOrigin, pair.meetAtCar, nonce) },
        "pi",
      );
    }
  }

  private async awardStamps(pair: RoomPair, m: MissionSessionState, now: number): Promise<Record<string, Stamp>> {
    const s = this.state;
    const where = this.stampStation();
    const out: Record<string, Stamp> = {};
    const rows = [pair.a, pair.b].map((uid) => {
      const partner = uid === pair.a ? pair.b : pair.a;
      const stamp: Stamp = {
        id: newId("stp"),
        stationId: where.stationId,
        station: where.stationName,
        line: s.trip?.line ?? "Green-D",
        partnerFirstName: s.riders[partner]?.profile.firstName ?? "",
        rare: m.rare,
        awardedAt: now,
      };
      out[uid] = stamp;
      return {
        ...stamp,
        userId: uid,
        partnerUserId: partner,
        matchId: pair.matchId,
        sessionId: m.sessionId,
      };
    });
    await insertStamps(this.env.DB, rows);
    for (const uid of [pair.a, pair.b]) {
      const stamp = out[uid];
      if (stamp) this.sendToRider(uid, { type: "stamp.awarded", stamp });
    }
    this.sendToKiosks(m.car, { type: "celebrate", matchId: pair.matchId, color: pair.color, rare: m.rare });
    await this.finishMission(m.sessionId, "stamped", now);
    return out;
  }

  /** Where a stamp is from: the stop the train is heading to. */
  private stampStation(): { stationId: string; stationName: string } {
    const s = this.state;
    const idx = s.nextStopIdx ?? s.currentStopIdx;
    const stop = s.stops[idx];
    return { stationId: stop?.stopId ?? "", stationName: stop?.name ?? "" };
  }

  /** Ends a mission, then clears its pair. Riders can be matched again after the next stop. */
  private async finishMission(sessionId: string, reason: "stamped" | "time-up" | "cancelled", now: number): Promise<void> {
    const s = this.state;
    const m = s.missions[sessionId];
    if (!m) return;
    const pair = s.pairs[m.matchId];
    delete s.missions[sessionId];
    await endMissionSession(this.env.DB, sessionId, reason, now);
    if (pair) {
      pair.sessionId = null;
      for (const uid of [pair.a, pair.b]) {
        this.sendToRider(uid, { type: "mission.end", sessionId, reason });
        const r = s.riders[uid];
        if (r) r.eligibleFromStopIdx = (s.nextStopIdx ?? s.stops.length) + 1;
      }
      await this.clearPair(pair.matchId, "mission-done", now, {}, "mission-done", reason === "stamped");
    }
    this.resetTag(m.car);
  }

  /**
   * Removes a pair. `reason` goes to both riders unless `perRider` overrides it for one of
   * them; `dbReason` is stored on the match. A stamped pair's kiosk gets pair.cleared after
   * the celebration instead of right away.
   */
  private async clearPair(
    matchId: string,
    reason: ClearReason,
    now: number,
    perRider: Record<string, ClearReason>,
    dbReason: MatchEndReason,
    celebrating = false,
  ): Promise<void> {
    const s = this.state;
    const pair = s.pairs[matchId];
    if (!pair) return;
    if (pair.sessionId) {
      const sessionId = pair.sessionId;
      const m = s.missions[sessionId];
      delete s.missions[sessionId];
      pair.sessionId = null;
      await endMissionSession(this.env.DB, sessionId, "cancelled", now);
      for (const uid of [pair.a, pair.b]) this.sendToRider(uid, { type: "mission.end", sessionId, reason: "cancelled" });
      if (m) this.resetTag(m.car);
    }
    delete s.pairs[matchId];
    for (const uid of [pair.a, pair.b]) {
      const r = s.riders[uid];
      if (r?.pairId === matchId) r.pairId = null;
      this.sendToRider(uid, { type: "match.cleared", matchId, reason: perRider[uid] ?? reason });
    }
    if (celebrating) {
      s.pendingKioskClears = [...(s.pendingKioskClears ?? []), { car: pair.meetAtCar, matchId, at: now + CELEBRATE_MS }];
    } else {
      this.sendToKiosks(pair.meetAtCar, { type: "pair.cleared", matchId });
    }
    await endMatch(this.env.DB, matchId, dbReason, now);
  }

  /** Puts the plain check-in URL back on a dynamic tag. */
  private resetTag(car: CarId): void {
    if ((this.state.kioskHw[car] ?? DEFAULT_KIOSK_HW).nfc !== "dynamic") return;
    this.sendToKiosks(car, { type: "nfc.write", writeId: newId("ses"), url: tagUrl(this.cfg.publicOrigin, car) }, "pi");
  }

  /** Removes a rider without rematching or broadcasting (callers do that once). */
  private async checkOutInner(userId: string, reason: CheckOutReason, now: number): Promise<void> {
    const r = this.state.riders[userId];
    if (!r) return;
    if (r.pairId) {
      const why = reason === "destination" ? "stop-reached" : "partner-left";
      await this.clearPair(r.pairId, why, now, {}, why);
    }
    await closeCheckin(this.env.DB, r.checkinId, reason, now);
    delete this.state.riders[userId];
    this.sendToRider(userId, { type: "ride.state", state: offRideState(r.ghost), serverNow: now });
    for (const ws of this.ctx.getWebSockets(riderTag(userId))) {
      try {
        ws.close(4000, "checked-out");
      } catch {
        // already closed
      }
    }
  }

  // ======================================================================
  // State helpers
  // ======================================================================

  private async ensureTrip(trip: TripInfo, now: number): Promise<void> {
    const s = this.state;
    const ended = s.trip?.demo && s.nextStopIdx === null && Object.keys(s.riders).length === 0;
    if (s.trip && !ended) return;
    // New trip, or a finished demo trip with nobody on it: start (again) from the first stop.
    s.trip = trip;
    s.demo = trip.demo ? newDemoClock(now) : null;
    s.pairs = {};
    s.missions = {};
    s.declinedPairs = [];
    this.refreshTimeline(now);
    await this.persist();
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put(STATE_KEY, this.state);
  }

  private ridersOnTrain(): number {
    return Object.values(this.state.riders).filter((r) => !r.ghost).length;
  }

  private stopName(stopId: string | null | undefined): string | null {
    if (!stopId) return null;
    return this.state.stops.find((s) => s.stopId === stopId)?.name ?? stopId;
  }

  private rideStateFor(userId: string): RideState {
    const s = this.state;
    const r = s.riders[userId];
    if (!r || !s.trip) return offRideState();
    const pair = r.pairId ? s.pairs[r.pairId] : undefined;
    const status = !pair ? "riding" : pair.sessionId ? "in-mission" : "matched";
    const next = s.nextStopIdx === null ? undefined : s.stops[s.nextStopIdx];
    return {
      status,
      tripId: s.trip.tripId,
      line: s.trip.line,
      car: r.car,
      destinationStop: this.stopName(r.destinationStop),
      destinationStopId: r.destinationStop,
      nextStop: next?.name ?? null,
      nextStopId: next?.stopId ?? null,
      nextStopEtaSec: s.nextStopEtaMs === null ? null : secondsUntil(s.nextStopEtaMs),
      ridersOnTrain: this.ridersOnTrain(),
      ghost: r.ghost,
    };
  }

  /** match.found payload from this rider's point of view, or null. */
  private matchPayloadFor(userId: string): MatchPayload | null {
    const s = this.state;
    const r = s.riders[userId];
    const pair = r?.pairId ? s.pairs[r.pairId] : undefined;
    if (!r || !pair) return null;
    const partner = s.riders[pair.a === userId ? pair.b : pair.a];
    if (!partner) return null;
    return {
      matchId: pair.matchId,
      partner: { firstName: partner.profile.firstName, color: pair.color, sharedTags: pair.sharedTags },
      why: pair.why,
      meetAtCar: pair.meetAtCar,
      carDelta: carDelta(s.trip?.carOrder ?? [], r.car, pair.meetAtCar),
      youWalk: pair.walker === userId,
      ...(pair.gameCode && { game: { code: pair.gameCode, seat: pair.a === userId ? ("a" as const) : ("b" as const) } }),
    };
  }

  private missionFor(userId: string): Mission | null {
    const s = this.state;
    const r = s.riders[userId];
    const pair = r?.pairId ? s.pairs[r.pairId] : undefined;
    const m = pair?.sessionId ? s.missions[pair.sessionId] : undefined;
    return m ? this.toWireMission(m) : null;
  }

  private toWireMission(m: MissionSessionState): Mission {
    return {
      sessionId: m.sessionId,
      templateId: m.templateId,
      category: m.category,
      title: m.title,
      prompt: m.prompt,
      endsAt: m.endsAt,
      rare: m.rare,
    };
  }

  private snapshotFor(userId: string): RideSnapshot {
    return {
      state: this.rideStateFor(userId),
      match: this.matchPayloadFor(userId),
      mission: this.missionFor(userId),
      serverNow: Date.now(),
    };
  }

  private pairIncoming(pair: RoomPair): ServerToKiosk {
    const name = (uid: string) => this.state.riders[uid]?.profile.firstName ?? "";
    return {
      type: "pair.incoming",
      matchId: pair.matchId,
      color: pair.color,
      firstNames: [name(pair.a), name(pair.b)],
      arrived: Math.min(2, pair.arrived.length),
    };
  }

  // ======================================================================
  // Sending
  // ======================================================================

  private sendToRider(userId: string, event: ServerToRider): void {
    send(this.ctx.getWebSockets(riderTag(userId)), event);
  }

  private sendToKiosks(car: CarId, event: ServerToKiosk, role?: KioskRole): void {
    send(this.ctx.getWebSockets(role ? kioskRoleTag(car, role) : kioskTag(car)), event);
  }

  private sendRideState(userId: string): void {
    this.sendToRider(userId, { type: "ride.state", state: this.rideStateFor(userId), serverNow: Date.now() });
  }

  private broadcastRideStates(): void {
    for (const userId of Object.keys(this.state.riders)) this.sendRideState(userId);
  }

  private kioskIdle(car: CarId): ServerToKiosk {
    const s = this.state;
    const next = s.nextStopIdx === null ? undefined : s.stops[s.nextStopIdx];
    return {
      type: "kiosk.idle",
      ridersInCar: Object.values(s.riders).filter((r) => !r.ghost && r.car === car).length,
      ridersOnTrain: this.ridersOnTrain(),
      nextStop: next?.name ?? null,
      nextStopEtaSec: s.nextStopEtaMs === null ? null : secondsUntil(s.nextStopEtaMs),
      serverNow: Date.now(),
    };
  }

  /** kiosk.idle (stats) to every connected kiosk; screens only show idle when no pair is there. */
  private broadcastKioskIdle(): void {
    const cars = new Set<CarId>([...(this.state.trip?.carOrder ?? []), ...Object.keys(this.state.kioskHw)]);
    for (const car of cars) this.sendToKiosks(car, this.kioskIdle(car));
  }

  /** After kiosk.hello: stats, then the pair and mission at this car, then (Pi) the tag URL. */
  private replayToKiosk(ws: WebSocket, car: CarId, role: KioskRole): void {
    const s = this.state;
    send([ws], this.kioskIdle(car));
    const pair = Object.values(s.pairs).find((p) => p.meetAtCar === car);
    const m = pair?.sessionId ? s.missions[pair.sessionId] : undefined;
    if (pair) send([ws], this.pairIncoming(pair));
    if (pair && m) send([ws], { type: "mission.show", matchId: pair.matchId, color: pair.color, mission: this.toWireMission(m), serverNow: Date.now() });
    if (role === "pi" && (s.kioskHw[car] ?? DEFAULT_KIOSK_HW).nfc === "dynamic") {
      const url = tagUrl(this.cfg.publicOrigin, car, m?.nonce ?? null);
      send([ws], { type: "nfc.write", writeId: m?.sessionId ?? newId("ses"), url });
    }
  }
}

// ---------- module helpers ----------

function send(sockets: WebSocket[], event: ServerToRider | ServerToKiosk): void {
  const data = JSON.stringify(event);
  for (const ws of sockets) {
    try {
      ws.send(data);
    } catch {
      // Socket closing; hibernation API cleans it up.
    }
  }
}

function attachmentFromRequest(pathname: string, headers: Headers): SocketAttachment | null {
  if (pathname === "/ws/rider") {
    const userId = headers.get(INTERNAL_HEADERS.user);
    return userId ? { kind: "rider", userId, client: null } : null;
  }
  if (pathname.startsWith("/ws/kiosk/")) {
    const car = headers.get(INTERNAL_HEADERS.kioskCar);
    const role = headers.get(INTERNAL_HEADERS.kioskRole);
    if (!car || (role !== "screen" && role !== "pi")) return null;
    return { kind: "kiosk", car, role };
  }
  return null;
}
