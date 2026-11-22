// The ride channel against the real worker: REST for taps and recovery, the rider
// WebSocket for everything live. It turns the worker's events into the ServerEvents the
// ride reducer understands, so no screen knows which backend it is talking to.
//
// Check-in, moving cars and the stamp all come from tapping a kiosk tag (/k/:car).
// Turning Ride Mode on is the consent to be matched: the phone sends rideMode: true only
// from the Ride Mode confirmation screen, and a match goes straight to "go to the kiosk".
import type {
  MatchInfo,
  Mission as WireMission,
  Profile as WireProfile,
  RideSnapshot,
  RideState as WireRide,
  ServerToRider,
  Stamp as WireStamp,
} from "@questline/protocol";
import type { Profile, SocialBattery } from "../../../shared/types";
import { api as rest, ApiError, type TapBody, type TapResult } from "../../lib/api";
import { clearToken, getSignupTicket, getToken, setSignupTicket, setToken } from "../../lib/auth";
import { connectRiderSocket, type RiderSocket } from "../../lib/socket";
import type { FellThroughReason, RideOverReason, ServerEvent } from "../../state/ride";
import type { RideChannel, RideContext } from "../types";
import { toCheckIn, toMatch, toMeet, toMission, toStamp, toWireProfile } from "./map";

const warn = (what: string, e?: unknown) => console.warn(`[questline] ${what}`, e ?? "");

export class BackendRide implements RideChannel {
  private subs = new Set<(e: ServerEvent) => void>();
  private socket: RiderSocket | null = null;
  /** The last riding state from the worker; null while Ride Mode is off. */
  private wire: WireRide | null = null;
  private match: MatchInfo | null = null;
  private mission: WireMission | null = null;
  private stamped = false;
  private selfTapped = false;
  /** We asked to turn Ride Mode off, so the "off" that follows is ours. */
  private leaving = false;
  /** serverNow - Date.now(), for countdowns. */
  private skew = 0;
  private stampIds = new Set<string>();
  private creating: Promise<void> | null = null;
  private watching = false;

  subscribe(fn: (e: ServerEvent) => void) {
    this.subs.add(fn);
    if (!this.watching) {
      this.watching = true;
      // An NFC tap opens a new tab, which changes the ride behind this tab's back.
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
   * Creates the rider on first save, PATCHes after that. A rider who verified a new email
   * sends the signup ticket on create, which makes them an account with that email;
   * otherwise it is a "Just play today" guest.
   */
  async saveProfile(profile: Profile): Promise<void> {
    if (!getToken()) {
      const ticket = getSignupTicket() ?? undefined;
      this.creating ??= rest
        .createUser(toWireProfile(profile) as WireProfile, ticket)
        .then((r) => {
          setToken(r.token);
          setSignupTicket(null);
        })
        .catch((e: unknown) => {
          // Expired/used ticket, or the email got an account meanwhile: drop the ticket so the
          // next try doesn't fail the same way, and surface the error.
          if (ticket && e instanceof ApiError && (e.status === 400 || e.status === 409)) setSignupTicket(null);
          throw e;
        })
        .finally(() => {
          this.creating = null;
        });
      return this.creating;
    }
    const { is18Plus: _is18, ...patch } = toWireProfile(profile);
    await rest.updateMe(patch);
  }

  signOut() {
    this.reset();
    clearToken();
  }

  /** Ride Mode is on (the worker has us checked in). */
  get riding(): boolean {
    return this.wire !== null;
  }

  // ---- worker -> phone ----

  /** Pull the whole ride from the worker: on load, on coming back to the tab, after a socket drop. */
  async sync(): Promise<void> {
    if (!getToken()) return;
    try {
      this.applySnapshot(await rest.getRideState());
    } catch (e) {
      // A token the worker no longer knows (database reset, data deleted): start over.
      if (e instanceof ApiError && e.status === 401) this.signOut();
      else warn("could not load the ride", e);
    }
  }

  private applySnapshot(s: RideSnapshot) {
    this.skew = s.serverNow - Date.now();
    this.applyState(s.state);
    if (!this.wire) return;

    if (s.match && s.match.matchId !== this.match?.matchId) this.onMatch(s.match);
    else if (!s.match && this.match && !this.stamped) this.onCleared("other");

    if (s.mission && s.mission.sessionId !== this.mission?.sessionId) this.onMission(s.mission);
  }

  private applyState(state: WireRide) {
    if (state.status === "off") {
      // The worker checked us out: our stop, the end of the line, or we turned it off.
      if (this.wire) this.emit({ type: "rideEnded", reason: this.leaving ? "you" : this.offReason(state) });
      this.reset();
      return;
    }
    const first = !this.wire;
    this.wire = state;
    const checkIn = toCheckIn(state);
    const nextStopAt = state.nextStopEtaSec === null ? undefined : Date.now() + state.nextStopEtaSec * 1000;
    if (first) this.emit({ type: "checkedIn", checkIn, nextStopAt, ridersOnTrain: state.ridersOnTrain });
    else this.emit({ type: "rideStatus", checkIn, nextStopAt, ridersOnTrain: state.ridersOnTrain, delayed: false });
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

  /** The worker doesn't say why it checked us out; if our stop was next, that's why. */
  private offReason(_state: WireRide): RideOverReason {
    const w = this.wire;
    if (w && w.nextStopId && w.nextStopId === w.destinationStopId) return "stop";
    return w?.nextStopId ? "tripEnded" : "stop";
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
      case "match.cleared": {
        if (e.matchId !== this.match?.matchId) return;
        // After a stamp the Stamp screen is up; the match ending is not news.
        if (e.reason === "mission-done") {
          if (!this.stamped && this.mission) this.emit({ type: "missionEnded" });
          this.match = this.mission = null;
          return;
        }
        const reason: FellThroughReason =
          e.reason === "you-not-now" ? "you" : e.reason === "partner-not-now" || e.reason === "partner-left" ? "partner" : "other";
        return this.onCleared(reason);
      }
      case "mission.start":
        this.skew = e.serverNow - Date.now();
        return this.onMission(e.mission);
      case "mission.end":
        if (e.sessionId === this.mission?.sessionId && e.reason === "time-up" && !this.stamped) {
          this.mission = null;
          this.emit({ type: "missionEnded" });
        }
        return;
      case "stamp.progress":
        // The event doesn't say who tapped; one tap that we just made is ours.
        return this.emit({ type: "stampProgress", taps: e.tapped, you: this.selfTapped });
      case "stamp.awarded":
        return this.award(e.stamp);
      case "pong":
        return;
    }
  }

  private onMatch(m: MatchInfo) {
    const same = m.matchId === this.match?.matchId;
    this.match = m;
    if (!same) {
      this.mission = null;
      this.stamped = false;
      this.selfTapped = false;
    }
    // Ride Mode is the consent (decision D5): no offer, straight to "go to the kiosk".
    // A repeat match.found (we moved cars) just updates where to go.
    this.emit({ type: "matched", match: toMatch(m), meet: toMeet(m) });
  }

  private onCleared(reason: FellThroughReason) {
    this.match = null;
    this.mission = null;
    this.emit({ type: "cancelled", reason });
  }

  private onMission(w: WireMission) {
    this.mission = w;
    const now = Date.now();
    this.emit({
      type: "missionAssigned",
      mission: toMission(w, now + this.skew),
      startedAt: now,
      endsAt: w.endsAt - this.skew,
    });
  }

  private award(w: WireStamp) {
    if (this.stampIds.has(w.id)) return;
    this.stampIds.add(w.id);
    this.stamped = true;
    this.emit({ type: "stampAwarded", stamp: toStamp(w, { missionId: this.mission?.templateId, matchId: this.match?.matchId }) });
  }

  private reset() {
    this.socket?.close();
    this.socket = null;
    this.wire = null;
    this.match = null;
    this.mission = null;
    this.stamped = this.selfTapped = this.leaving = false;
  }

  // ---- phone -> worker ----

  /** The kiosk tag landing (/k/:car?n=). The worker decides: check in, move car, or stamp. */
  async tapKiosk(body: TapBody, ctx: RideContext): Promise<TapResult> {
    if (!getToken()) await this.saveProfile(ctx.profile);
    if (!this.wire) await this.sync();
    const res = await rest.tap(body);
    if (res.result === "checked-in" || res.result === "moved-car") {
      this.applyState(res.state);
      if (res.result === "moved-car" && this.match && res.state.car === this.match.meetAtCar) this.emit({ type: "arrived" });
    }
    if (res.result === "stamp-pending") {
      this.selfTapped = true;
      this.emit({ type: "stampProgress", taps: 1, you: true });
    }
    if (res.result === "stamp-awarded") this.award(res.stamp);
    return res;
  }

  checkOut() {
    if (!this.wire) return;
    this.leaving = true;
    rest
      .endRide()
      .catch((e) => warn("could not end the ride", e))
      .finally(() => this.reset());
  }

  setMood(mood: SocialBattery) {
    if (getToken()) rest.setMood(mood).catch((e) => warn("could not change social battery", e));
  }

  setGhost(ghost: boolean) {
    if (getToken()) rest.setGhost(ghost).catch((e) => warn("could not change ghost mode", e));
  }

  notNow() {
    if (!this.match) return;
    if (!(this.socket?.send({ type: "rider.notNow" }) ?? false)) {
      rest.notNow().catch((e) => warn("could not send Not now", e));
    }
  }

  arrived() {
    this.emit({ type: "arrived" });
    if (!(this.socket?.send({ type: "rider.arrived" }) ?? false)) {
      rest.arrived().catch((e) => warn("could not send arrived", e));
    }
  }
}
