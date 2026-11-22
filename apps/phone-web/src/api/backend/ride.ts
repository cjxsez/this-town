// The ride channel against the real worker: REST for taps and recovery, the rider
// WebSocket for everything live. It turns the worker's events into the ServerEvents the
// ride reducer already understands, so no screen knows which backend it is talking to.
//
// Where the two models differ (see README "Frontend and worker differences"):
// - The worker has no accept step: turning Ride Mode on is the consent. The phone still asks
//   Yes / Skip, so Yes stays on this device and Skip sends "Not now".
// - Check-in and the stamp both come from tapping the kiosk tag (/k/:car), not from C1 or a bump.
// - Photos, mood changes and new prompts have no worker routes yet.
import type { MatchInfo, Mission as WireMission, Profile as WireProfile, RideSnapshot, RideState as WireRide, ServerToRider, Stamp as WireStamp } from "@questline/protocol";
import type { CheckIn, Profile, SocialBattery } from "../../../shared/types";
import { api as rest, ApiError, type TapBody, type TapResult } from "../../lib/api";
import { clearToken, getSignupTicket, getToken, setSignupTicket, setToken } from "../../lib/auth";
import { connectRiderSocket, type RiderSocket } from "../../lib/socket";
import type { ServerEvent } from "../../state/ride";
import type { RideChannel, RideContext } from "../types";
import { toCheckIn, toMatch, toMeetSpot, toMission, toOpener, toStamp, toWireProfile } from "./map";

/** Shown when the worker has no prediction for the next stop. */
const FALLBACK_ETA_S = 120;

const warn = (what: string, e?: unknown) => console.warn(`[questline] ${what}`, e ?? "");
const noRoute = (what: string) => {
  if (import.meta.env.DEV) console.info(`[questline] ${what}: the worker has no route for this yet`);
};

export class BackendRide implements RideChannel {
  private subs = new Set<(e: ServerEvent) => void>();
  private socket: RiderSocket | null = null;
  /** The last riding state from the worker; null while Ride Mode is off. */
  private wire: WireRide | null = null;
  private match: MatchInfo | null = null;
  private mission: WireMission | null = null;
  private accepted = false;
  /** A mission started, so the pair physically met at the kiosk. */
  private hasMet = false;
  private stamped = false;
  private selfTapped = false;
  /** serverNow - Date.now(), for countdowns. */
  private skew = 0;
  private stampIds = new Set<string>();
  private creating: Promise<void> | null = null;
  private watching = false;

  subscribe(fn: (e: ServerEvent) => void) {
    this.subs.add(fn);
    if (!this.watching) {
      this.watching = true;
      // A tap in another tab (NFC opens a new one) changes the ride behind this tab's back.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void this.sync();
      });
      void this.sync();
    }
    return () => {
      this.subs.delete(fn);
    };
  }

  private emit(e: ServerEvent) {
    for (const fn of this.subs) fn(e);
  }

  // ---- account ----

  /**
   * The worker creates riders once and has no profile update route, so this only runs without
   * a token. A rider who verified a new email sends the signup ticket, which makes the new
   * rider an account with that email; otherwise it is a "Just play today" guest.
   */
  ensureUser(profile: Profile): Promise<void> {
    if (getToken()) return Promise.resolve();
    const ticket = getSignupTicket() ?? undefined;
    this.creating ??= rest
      .createUser(toWireProfile(profile) as WireProfile, ticket)
      .then((r) => {
        setToken(r.token);
        setSignupTicket(null);
      })
      .catch((e: unknown) => {
        // Expired/used ticket or the email got an account meanwhile: drop the ticket so the
        // next try doesn't fail the same way, and surface the error.
        if (ticket && e instanceof ApiError && (e.status === 400 || e.status === 409)) setSignupTicket(null);
        throw e;
      })
      .finally(() => {
        this.creating = null;
      });
    return this.creating;
  }

  signOut() {
    this.reset();
    clearToken();
  }

  // ---- worker -> phone ----

  /** Pull the whole ride from the worker: on load, on coming back to the tab, after a socket drop. */
  async sync(): Promise<void> {
    if (!getToken()) return;
    try {
      this.applySnapshot(await rest.getRideState());
    } catch (e) {
      // A token the worker no longer knows (database reset): start over at the next tap.
      if (e instanceof ApiError && e.status === 401) this.signOut();
      else warn("could not load the ride", e);
    }
  }

  private applySnapshot(s: RideSnapshot) {
    this.skew = s.serverNow - Date.now();
    this.applyState(s.state);
    if (!this.wire) return;

    if (s.match && s.match.matchId !== this.match?.matchId) this.onMatch(s.match);
    else if (!s.match) this.clearMatch();

    if (s.mission && s.mission.sessionId !== this.mission?.sessionId) this.onMission(s.mission);
    else if (!s.mission && this.mission) this.onMissionEnd(this.stamped);
  }

  private applyState(state: WireRide) {
    if (state.status === "off") {
      // The ride ended on the worker's side: the rider's stop came, or they checked out elsewhere.
      if (this.wire) this.emit({ type: "trainDeparted" });
      this.reset();
      return;
    }
    const first = !this.wire;
    this.wire = state;
    const trainAt = this.trainAt(state);
    if (first) this.emit({ type: "checkedIn", checkIn: toCheckIn(state), trainAt, delayed: false });
    else this.emit({ type: "trainEta", trainAt, delayed: false });
    // The worker only accepts rider sockets once checked in.
    this.socket ??= connectRiderSocket(getToken()!, {
      onEvent: (e) => this.onEvent(e),
      onStatus: (status) => {
        if (status === "open") this.emit({ type: "connection", online: true });
        if (status === "closed" && this.wire) {
          this.emit({ type: "connection", online: false });
          void this.sync();
        }
      },
    });
  }

  private trainAt(state: WireRide) {
    return Date.now() + (state.nextStopEtaSec ?? FALLBACK_ETA_S) * 1000;
  }

  private onEvent(e: ServerToRider) {
    switch (e.type) {
      case "ride.snapshot":
        return this.applySnapshot(e.snapshot);
      case "ride.state":
        this.skew = e.serverNow - Date.now();
        return this.applyState(e.state);
      case "match.found":
        return this.onMatch(e);
      case "match.cleared":
        if (e.matchId !== this.match?.matchId) return;
        // After a stamp the Stamp screen is up; the match ending is not news.
        return this.clearMatch(e.reason === "mission-done");
      case "mission.start":
        this.skew = e.serverNow - Date.now();
        return this.onMission(e.mission);
      case "mission.end":
        if (e.sessionId === this.mission?.sessionId) this.onMissionEnd(e.reason === "stamped");
        return;
      case "stamp.progress":
        // The event does not say who tapped; the first tap is ours if we just made one.
        if (e.tapped === 2 || !this.selfTapped) this.emit({ type: "partnerBumped" });
        return;
      case "stamp.awarded":
        return this.award(e.stamp);
      case "pong":
        return;
    }
  }

  private onMatch(m: MatchInfo) {
    this.match = m;
    this.mission = null;
    this.hasMet = false;
    this.stamped = false;
    this.selfTapped = false;
    this.accepted = false;
    // Ride Mode is the consent (docs/decisions.md D5): a match goes straight to "meet".
    // No offer card and no timeout: the phone is usually in a pocket while the glasses show
    // the match, so an unanswered offer must never decline it. "Not now" is decline().
    this.accept();
  }

  private accept() {
    const m = this.match;
    if (!m || this.accepted) return;
    this.accepted = true;
    this.emit({ type: "matched", match: toMatch(m), meetSpot: toMeetSpot(m), opener: toOpener(m) });
  }

  private decline() {
    if (this.match && !(this.socket?.send({ type: "rider.notNow" }) ?? false)) {
      rest.notNow().catch((e) => warn("could not send Not now", e));
    }
    this.match = null;
    this.mission = null;
    this.emit({ type: "cancelled" });
  }

  private clearMatch(quiet = this.stamped) {
    if (!this.match) return;
    const met = this.hasMet;
    this.match = null;
    this.mission = null;
    if (!quiet) this.emit({ type: met ? "ended" : "cancelled" });
  }

  private onMission(w: WireMission) {
    this.mission = w;
    this.hasMet = true;
    // The kiosk only starts a mission once both riders are standing at it.
    this.accept();
    const now = Date.now();
    this.emit({
      type: "missionAssigned",
      mission: toMission(w, now + this.skew),
      startedAt: now,
      endsAt: w.endsAt - this.skew,
      swapped: false,
    });
  }

  private onMissionEnd(stamped: boolean) {
    this.mission = null;
    if (!stamped) this.emit({ type: "ended" });
  }

  private award(w: WireStamp) {
    if (this.stampIds.has(w.id)) return;
    this.stampIds.add(w.id);
    this.stamped = true;
    this.accept();
    this.emit({
      type: "stampAwarded",
      stamp: toStamp(w, { missionId: this.mission?.templateId, matchId: this.match?.matchId }),
    });
  }

  private reset() {
    this.socket?.close();
    this.socket = null;
    this.wire = null;
    this.match = null;
    this.mission = null;
    this.accepted = this.hasMet = this.stamped = this.selfTapped = false;
  }

  // ---- phone -> worker ----

  /** The kiosk tag landing (/k/:car?n=). The worker decides: check in, move car, or stamp. */
  async tap(body: TapBody, profile: Profile): Promise<TapResult> {
    await this.ensureUser(profile);
    if (!this.wire) await this.sync();
    const res = await rest.tap(body);
    if (res.result === "checked-in" || res.result === "moved-car") this.applyState(res.state);
    if (res.result === "stamp-pending") this.selfTapped = true;
    if (res.result === "stamp-awarded") this.award(res.stamp);
    return res;
  }

  /**
   * Stand-in for a kiosk tap while developing without one: VITE_DEMO_CAR names the car to
   * tap, riding to the end of the line.
   */
  private async demoTap(profile: Profile) {
    const car = import.meta.env.VITE_DEMO_CAR;
    if (!car) return warn("check in by tapping the kiosk tag in your car (or set VITE_DEMO_CAR)");
    try {
      const res = await this.tap({ car }, profile);
      if (res.result === "need-destination") await this.tap({ car, destinationStop: res.stops.at(-1)?.id }, profile);
      else if (res.result === "error") warn(res.message);
    } catch (e) {
      warn("check-in failed", e);
    }
  }

  checkIn(_c: CheckIn, ctx: RideContext) {
    void this.demoTap(ctx.profile);
  }

  keepOnNextStation() {
    noRoute("keep on for the next station");
  }

  checkOut() {
    if (!this.wire) return;
    this.reset();
    rest.endRide().catch((e) => warn("could not end the ride", e));
  }

  /** After the recap the worker still has the rider on the train; put the phone back in the pool. */
  resync() {
    if (this.wire) this.emit({ type: "checkedIn", checkIn: toCheckIn(this.wire), trainAt: this.trainAt(this.wire), delayed: false });
  }

  setMood(_mood: SocialBattery) {
    noRoute("changing social battery mid-ride");
  }

  setGhost(ghost: boolean) {
    if (getToken()) rest.setGhost(ghost).catch((e) => warn("could not change ghost mode", e));
  }

  respondOffer(yes: boolean) {
    if (yes) this.accept();
    else this.decline();
  }

  withdraw() {
    this.decline();
  }

  private arrived() {
    if (!(this.socket?.send({ type: "rider.arrived" }) ?? false)) {
      rest.arrived().catch((e) => warn("could not send arrived", e));
    }
  }

  atSpot() {
    this.arrived();
  }

  met() {}

  /** The kiosk starts the mission when both riders have arrived; saying so again is harmless. */
  startQuest() {
    this.arrived();
  }

  newPrompt() {
    noRoute("swapping the mission");
  }

  /** The stamp comes from both riders tapping the kiosk tag, which lands on /k/:car. */
  missionDone() {}

  bump() {
    noRoute("phone bump (tap the kiosk tag instead)");
  }

  /** No photo routes yet: answer for the partner so the quest moves on to the recap. */
  photoVote(yes: boolean) {
    if (yes) this.emit({ type: "photoVotes", partner: false });
  }

  takePhoto() {
    noRoute("photos");
  }

  keepVote(_keep: boolean) {
    noRoute("photos");
  }

  /** On the train already; "I'm boarding" just closes the quest on this phone. */
  board() {
    this.emit({ type: "ended" });
  }
}
