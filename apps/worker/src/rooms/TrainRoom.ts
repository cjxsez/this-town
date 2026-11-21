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
 * TODO (in order of the happy path):
 * 1. checkIn: ensureTrip, load profile + met/blocked/recent templates from D1, insert
 *    checkins row, add RoomRider, persist, send ride.state, broadcastKioskIdle, runMatching,
 *    scheduleAlarm. Return { result: "checked-in", state }.
 * 2. runMatching: buildPool -> greedyPairs -> for each: assignColor (skip if null), why from
 *    whyCache or writeWhy, insertMatch, create RoomPair with autoStartAt = now +
 *    MISSION_AUTOSTART_DELAY_MS, send match.found to both (carDelta/youWalk per rider),
 *    pair.incoming to kiosks in meetAtCar, ride.state to both.
 * 3. markArrived (rider.arrived, or moveCar into meetAtCar): start the mission once the
 *    walker has arrived (same car, walker === null: start right away), or when autoStartAt
 *    passes in the alarm.
 * 4. startMission: availableSec = (nextStopEtaMs - MISSION_END_BUFFER_MS - now)/1000;
 *    selectMission (late-bonus if delaySec > LATE_BONUS_MIN_DELAY_S); if null, leave
 *    autoStartAt for the next segment. Else newNonce() (unless kiosk nfc != dynamic),
 *    insertMissionSession, recordMet, send mission.start to both riders, mission.show to
 *    the kiosk, nfc.write tagUrl(origin, car, nonce) to the Pi.
 * 5. stampTap: valid nonce (or static tag) within endsAt + STAMP_GRACE_MS -> record tap;
 *    first tap returns stamp-pending, second awards: insertStamps (two rows), stamp.awarded
 *    to each rider, celebrate to kiosk, mission.end "stamped", then clearPair
 *    "mission-done". Return { result: "stamp-awarded", stamp } to the second tapper.
 *    TODO(protocol): the first tapper only learns about the award via stamp.awarded.
 * 6. endMission "time-up": mission.end to riders, pair.cleared to kiosk, nfc.write plain
 *    tagUrl(origin, car) to the Pi, clearPair "mission-done", eligibleFromStopIdx = next.
 * 7. checkOut: clear pair (partner gets match.cleared "partner-left" or "stop-reached"),
 *    closeCheckin, remove rider, close their sockets (code 4000 "checked-out"), rematch.
 * 8. notNow: notNowUntil = now + NOT_NOW_COOLDOWN_S, add pairKey to declinedPairs, partner
 *    gets match.cleared "partner-not-now", rematch the partner.
 *    TODO(protocol): no match.cleared reason for the rider who pressed "Not now"; they get
 *    ride.state only.
 * 9. Trip end (no predictions for ~2 polls, or last stop reached): check everyone out with
 *    "trip-ended", close kiosk sockets with 4002 so they reconnect to their next trip.
 */
import { DurableObject } from "cloudflare:workers";
import {
  WS_PING,
  WS_PONG,
  KioskToServer,
  RiderToServer,
  type CarId,
  type RideState,
  type ServerToKiosk,
  type ServerToRider,
} from "@questline/protocol";
import { readConfig, type Env } from "../env";
import type { MatchPayload, RidePollRes, TapResT } from "../lib/api";
import { ALARM_INTERVAL_MS, secondsUntil } from "../lib/time";
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
  type KioskRole,
  type RoomState,
  type SocketAttachment,
  type TripInfo,
} from "./state";

const STATE_KEY = "state";

type RiderAttachment = Extract<SocketAttachment, { kind: "rider" }>;
type KioskAttachment = Extract<SocketAttachment, { kind: "kiosk" }>;

export class TrainRoom extends DurableObject<Env> {
  private state: RoomState = emptyRoomState();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<RoomState>(STATE_KEY);
      if (saved) this.state = saved;
    });
    // Answer keepalives without waking the hibernated DO. Clients send exactly WS_PING.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(WS_PING, WS_PONG));
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
    if (tripHeader) await this.ensureTrip(JSON.parse(tripHeader) as TripInfo);

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server, tagsFor(att));
    server.serializeAttachment(att);

    if (att.kind === "kiosk") {
      // TODO: replay current view for this car (pair.incoming / mission.show, else kiosk.idle).
      await this.scheduleAlarm(Date.now());
    }
    // Riders get their snapshot on rider.hello.
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

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    // A closed socket never checks a rider out; check-out comes from MBTA or /api/ride/end.
    try {
      ws.close(code, reason);
    } catch {
      // 1005/1006 cannot be echoed; the socket is already gone.
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    // TODO: log. Same as close: no state change.
  }

  private async onRiderMessage(ws: WebSocket, att: RiderAttachment, msg: RiderToServer): Promise<void> {
    switch (msg.type) {
      case "rider.hello":
        ws.serializeAttachment({ ...att, client: msg.client } satisfies RiderAttachment);
        this.replayToRider(ws, att.userId);
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
          ws.close(4003, "car mismatch");
          return;
        }
        if (msg.hw) {
          this.state.kioskHw[att.car] = msg.hw;
          await this.persist();
        }
        // TODO: replay current view for this car.
        return;
      case "nfc.written":
        // TODO: find the mission at att.car whose tag URL equals msg.url, set nonceWrittenAt.
        return;
      case "ping":
        return;
    }
  }

  // ======================================================================
  // RPC methods (routes -> room)
  // ======================================================================

  /** First tap of a ride on this trip. Route has already validated destinationStop. */
  async checkIn(input: CheckInInput): Promise<TapResT> {
    throw new Error("TODO: TrainRoom.checkIn (see header step 1)");
  }

  /** Tap on a different car's kiosk on the same trip. Counts as arrival if it is meetAtCar. */
  async moveCar(userId: string, car: CarId): Promise<TapResT> {
    throw new Error("TODO: TrainRoom.moveCar (update car, updateCheckinCar, markArrived, rematch)");
  }

  async checkOut(userId: string, reason: CheckOutReason): Promise<void> {
    throw new Error("TODO: TrainRoom.checkOut (see header step 7)");
  }

  /** rider.notNow from the glasses pinch. */
  async notNow(userId: string): Promise<void> {
    throw new Error("TODO: TrainRoom.notNow (see header step 8)");
  }

  /**
   * A tap at `car` by a checked-in rider. Returns null when it is not a stamp attempt (no
   * mission for this rider at this car), so the route falls through to move-car / re-tap.
   */
  async stampTap(input: { userId: string; car: CarId; nonce?: string }): Promise<TapResT | null> {
    throw new Error("TODO: TrainRoom.stampTap (see header step 5)");
  }

  async setGhost(userId: string, ghost: boolean): Promise<RideState> {
    throw new Error("TODO: set rider.ghost, setUserGhost, clear pair with reason 'ghost', rematch, broadcast");
  }

  /** GET /api/ride/state polling fallback for the glasses. */
  async snapshot(userId: string): Promise<RidePollRes> {
    return {
      state: this.rideStateFor(userId),
      match: this.matchPayloadFor(userId),
      mission: null, // TODO: current Mission for this rider's pair
    };
  }

  /** Stop names a rider can pick as destination (after the next stop is reached, on). */
  async upcomingStops(trip: TripInfo): Promise<string[]> {
    await this.ensureTrip(trip);
    // TODO: if stops are empty, refreshTimeline first.
    const from = this.state.nextStopIdx ?? this.state.stops.length;
    return this.state.stops.slice(from).map((s) => s.name);
  }

  /** POST /api/report while the match is live: end it now. */
  async clearForReport(matchId: string, reporterId: string): Promise<void> {
    throw new Error("TODO: end mission (cancelled), clear pair, endMatch 'reported', both get match.cleared");
  }

  async demoTriggerDelay(seconds: number): Promise<void> {
    throw new Error("TODO: state.demo.delaySec += seconds, refreshTimeline, broadcast, runMatching");
  }

  async demoAdvance(): Promise<void> {
    throw new Error("TODO: state.demo = advanceDemoClock(state.demo, now), then tick");
  }

  async demoReset(): Promise<void> {
    throw new Error("TODO: check everyone out, close sockets, state = emptyRoomState(), persist");
  }

  // ======================================================================
  // Alarm loop
  // ======================================================================

  async alarm(): Promise<void> {
    await this.tick(Date.now());
    await this.scheduleAlarm(Date.now());
  }

  private async tick(now: number): Promise<void> {
    throw new Error("TODO: refreshTimeline, advance stops, check-outs, mission end/start, runMatching, broadcast");
  }

  private async scheduleAlarm(now: number): Promise<void> {
    const deadlines: number[] = [];
    if (Object.keys(this.state.riders).length > 0 || this.ctx.getWebSockets().length > 0) {
      deadlines.push(now + ALARM_INTERVAL_MS);
    }
    for (const p of Object.values(this.state.pairs)) if (p.autoStartAt !== null) deadlines.push(p.autoStartAt);
    for (const m of Object.values(this.state.missions)) deadlines.push(m.endsAt);
    if (this.state.nextStopEtaMs !== null && deadlines.length > 0) deadlines.push(this.state.nextStopEtaMs);
    if (deadlines.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(Math.max(now + 1000, Math.min(...deadlines)));
  }

  /** MBTA predictions (live) or demoTimeline (demo). Updates stops/next/eta/delay. */
  private async refreshTimeline(now: number): Promise<void> {
    throw new Error("TODO: trip.demo ? demoTimeline(state.demo, now) : fetchTripTimeline(env, tripId, stops, now)");
  }

  // ======================================================================
  // Matching + missions
  // ======================================================================

  private async runMatching(now: number): Promise<void> {
    throw new Error("TODO: see header step 2 (matching/pool, score, pair, colors; llm/why)");
  }

  private async markArrived(userId: string, now: number): Promise<void> {
    throw new Error("TODO: see header step 3");
  }

  private async startMission(matchId: string, now: number): Promise<void> {
    throw new Error("TODO: see header step 4 (missions/select, fill; nfc)");
  }

  private async endMission(sessionId: string, reason: "stamped" | "time-up" | "cancelled", now: number): Promise<void> {
    throw new Error("TODO: see header step 6");
  }

  // ======================================================================
  // State helpers
  // ======================================================================

  private async ensureTrip(trip: TripInfo): Promise<void> {
    if (this.state.trip) return;
    this.state.trip = trip;
    // TODO: if trip.demo, this.state.demo = newDemoClock(Date.now()).
    await this.persist();
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put(STATE_KEY, this.state);
  }

  private ridersOnTrain(): number {
    return Object.values(this.state.riders).filter((r) => !r.ghost).length;
  }

  private rideStateFor(userId: string): RideState {
    const s = this.state;
    const r = s.riders[userId];
    if (!r || !s.trip) return offRideState();
    const pair = r.pairId ? s.pairs[r.pairId] : undefined;
    const status = !pair ? "riding" : pair.sessionId ? "in-mission" : "matched";
    return {
      status,
      tripId: s.trip.tripId,
      line: s.trip.line,
      car: r.car,
      destinationStop: r.destinationStop,
      nextStop: s.nextStopIdx === null ? null : (s.stops[s.nextStopIdx]?.name ?? null),
      nextStopEtaSec: s.nextStopEtaMs === null ? null : secondsUntil(s.nextStopEtaMs),
      ridersOnTrain: this.ridersOnTrain(),
      ghost: r.ghost,
    };
  }

  /** match.found payload from this rider's point of view, or null. */
  private matchPayloadFor(userId: string): MatchPayload | null {
    // TODO: partner firstName/color/sharedTags, why, meetAtCar, carDelta (pair.ts), youWalk.
    return null;
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

  /** ride.state snapshot plus match.found / mission.start replay after (re)connect. */
  private replayToRider(ws: WebSocket, userId: string): void {
    send([ws], {
      type: "ride.snapshot",
      snapshot: {
        state: this.rideStateFor(userId),
        match: this.matchPayloadFor(userId),
        mission: null, // TODO: current Mission for this rider's pair
        serverNow: Date.now(),
      },
    });
  }

  /** kiosk.idle to every car with no active pair meeting there. */
  private broadcastKioskIdle(): void {
    const s = this.state;
    const busy = new Set(Object.values(s.pairs).map((p) => p.meetAtCar));
    const cars = new Set<CarId>([...(s.trip?.carOrder ?? []), ...Object.keys(s.kioskHw)]);
    const nextStop = s.nextStopIdx === null ? null : (s.stops[s.nextStopIdx]?.name ?? null);
    const nextStopEtaSec = s.nextStopEtaMs === null ? null : secondsUntil(s.nextStopEtaMs);
    const ridersOnTrain = this.ridersOnTrain();
    for (const car of cars) {
      if (busy.has(car)) continue;
      const ridersInCar = Object.values(s.riders).filter((r) => !r.ghost && r.car === car).length;
      this.sendToKiosks(car, {
        type: "kiosk.idle",
        ridersInCar,
        ridersOnTrain,
        nextStop,
        nextStopEtaSec,
        serverNow: Date.now(),
      });
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
