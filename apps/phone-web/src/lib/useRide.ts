/**
 * useRide.ts: live ride state for the phone, fed by the rider socket.
 *
 * Responsible for:
 * - One app-wide socket (socket.ts), opened lazily on first subscriber once a token exists,
 *   and kept open across screens so the rider never misses match.found.
 * - A tiny external store (useSyncExternalStore) holding:
 *   RideState, the current match (from match.found), the current mission (from mission.start),
 *   the last stamp and the last match.cleared reason, plus the socket connection status.
 * - Letting REST responses update the store too: TapRes "checked-in"/"moved-car" carry a
 *   RideState (applyRideState), and ending the ride resets it (resetRide).
 *
 * Events consumed (ServerToRider):
 * - ride.state      -> state (off/riding also clears any stale match + mission)
 * - match.found     -> match
 * - match.cleared   -> clear match + mission if it is the current matchId
 * - mission.start   -> mission
 * - mission.end     -> clear mission if it is the current sessionId
 * - stamp.awarded   -> lastStamp
 *
 * TODO:
 * - Replay on reconnect: RideState has no match/mission fields, so after a reconnect the phone
 *   only knows status "matched" until the worker re-sends match.found (see README gaps).
 * - Clock skew: mission.endsAt is server epoch ms; estimate offset if countdowns look off.
 */
import { useSyncExternalStore } from "react";
import type { Mission, RideState, RiderToServer, ServerToRider, Stamp } from "@questline/protocol";
import { getToken } from "./auth";
import { connectRiderSocket, type RiderSocket, type SocketStatus } from "./socket";

type MatchFound = Extract<ServerToRider, { type: "match.found" }>;
type MatchCleared = Extract<ServerToRider, { type: "match.cleared" }>;

/** match.found without the `type` tag. */
export type CurrentMatch = Omit<MatchFound, "type">;

export interface RideSnapshot {
  connection: SocketStatus;
  state: RideState | null;
  /** Date.now() when `state` arrived; nextStopEtaSec is relative to this. */
  stateAt: number;
  match: CurrentMatch | null;
  mission: Mission | null;
  lastStamp: Stamp | null;
  lastCleared: MatchCleared["reason"] | null;
}

const INITIAL: RideSnapshot = {
  connection: "idle",
  state: null,
  stateAt: 0,
  match: null,
  mission: null,
  lastStamp: null,
  lastCleared: null,
};

let snapshot: RideSnapshot = INITIAL;
const listeners = new Set<() => void>();
let socket: RiderSocket | null = null;

function setSnapshot(next: RideSnapshot) {
  if (next === snapshot) return;
  snapshot = next;
  listeners.forEach((l) => l());
}

function reduce(s: RideSnapshot, e: ServerToRider): RideSnapshot {
  switch (e.type) {
    case "ride.snapshot":
      // Sent after rider.hello: replace everything we know with the server's view.
      // TODO: store e.snapshot.serverNow - Date.now() as a clock offset for countdowns.
      return {
        ...s,
        state: e.snapshot.state,
        stateAt: Date.now(),
        match: e.snapshot.match,
        mission: e.snapshot.mission,
      };
    case "stamp.progress":
      // TODO: show "waiting for your partner to tap" on the Tap screen.
      return s;
    case "ride.state": {
      const unpaired = e.state.status === "off" || e.state.status === "riding";
      return {
        ...s,
        state: e.state,
        stateAt: Date.now(),
        match: unpaired ? null : s.match,
        mission: unpaired ? null : s.mission,
      };
    }
    case "match.found":
      return {
        ...s,
        lastCleared: null,
        match: {
          matchId: e.matchId,
          partner: e.partner,
          why: e.why,
          meetAtCar: e.meetAtCar,
          carDelta: e.carDelta,
          youWalk: e.youWalk,
        },
      };
    case "match.cleared":
      return s.match?.matchId === e.matchId
        ? { ...s, match: null, mission: null, lastCleared: e.reason }
        : s;
    case "mission.start":
      return { ...s, mission: e.mission };
    case "mission.end":
      return s.mission?.sessionId === e.sessionId ? { ...s, mission: null } : s;
    case "stamp.awarded":
      return { ...s, lastStamp: e.stamp };
    default:
      return s;
  }
}

/** Open the socket if we have a token and it is not open yet. Call after onboarding. */
export function ensureRideSocket(): void {
  if (socket) return;
  const token = getToken();
  if (!token) return;
  socket = connectRiderSocket(token, {
    onEvent: (e) => setSnapshot(reduce(snapshot, e)),
    onStatus: (connection) => setSnapshot({ ...snapshot, connection }),
  });
}

/** Reconnect now, e.g. after a tap checked us in to a (possibly new) trip. */
export function reconnectRideSocket(): void {
  if (socket) socket.reconnect();
  else ensureRideSocket();
}

/** Close the socket and forget state (sign out). */
export function disconnectRide(): void {
  socket?.close();
  socket = null;
  setSnapshot(INITIAL);
}

/** Apply a RideState that came from REST (TapRes) or an optimistic local change. */
export function applyRideState(state: RideState): void {
  setSnapshot(reduce(snapshot, { type: "ride.state", state, serverNow: Date.now() }));
}

/** Ride ended locally (POST /api/ride/end succeeded). */
export function resetRide(): void {
  setSnapshot({ ...INITIAL, connection: snapshot.connection });
}

export function sendToRoom(msg: RiderToServer): void {
  socket?.send(msg);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  ensureRideSocket();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RideSnapshot {
  return snapshot;
}

export function useRide(): RideSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
