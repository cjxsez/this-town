// The phone's ride state machine (src/state/ride.ts): which screen each server event and
// each of the rider's own taps leads to.
import test from "node:test";
import assert from "node:assert/strict";
import { initialRide, rideModeOn, rideReducer, type RideAction, type RideState } from "../src/state/ride";

// Only the fields the reducer passes through; the screens read the rest.
const checkIn = { car: "1412", line: "green" } as never;
const match = { id: "mat_1", firstName: "Maya", color: "orange" } as never;
const meet = { car: "1413", carDelta: 1 } as never;
const mission = { id: "ses_1", title: "Station mascot" } as never;
const stamp = { id: "stp_1", stationId: "hynes" } as never;

const run = (...actions: RideAction[]) => actions.reduce(rideReducer, initialRide);
const riding = () => run({ type: "checkedIn", checkIn, ridersOnTrain: 3 });
const meeting = () => rideReducer(riding(), { type: "matched", match, meet });
const playing = () => rideReducer(meeting(), { type: "missionAssigned", mission, startedAt: 1, endsAt: 2 });

test("checking in turns Ride Mode on and starts the ride's counts from zero", () => {
  const s = riding();
  assert.equal(s.phase, "riding");
  assert.equal(s.ridersOnTrain, 3);
  assert.equal(s.stampsThisRide, 0);
  assert.equal(rideModeOn(s), true);
  assert.equal(rideModeOn(initialRide), false);
});

test("a match goes straight to 'go to the kiosk' with no accept step", () => {
  const s = meeting();
  assert.equal(s.phase, "meet");
  assert.equal(s.match, match);
  assert.equal(s.arrived, false);
});

test("a match that arrives mid-mission or after the ride is ignored", () => {
  const p = playing();
  assert.equal(rideReducer(p, { type: "matched", match, meet }), p);
  assert.equal(rideReducer(initialRide, { type: "matched", match, meet }), initialRide);
});

test("arriving at the kiosk is remembered until the mission starts", () => {
  assert.equal(rideReducer(meeting(), { type: "arrived" }).arrived, true);
});

test("a mission counts the person met once, even if the server sends it again", () => {
  const p = playing();
  assert.equal(p.phase, "mission");
  assert.equal(p.peopleThisRide, 1);
  const again = rideReducer(p, { type: "missionAssigned", mission, startedAt: 1, endsAt: 2 });
  assert.equal(again.peopleThisRide, 1);
});

test("stamp taps only go up, and remember whether one was yours", () => {
  let s = rideReducer(playing(), { type: "stampProgress", taps: 1, you: false });
  assert.deepEqual([s.taps, s.youTapped], [1, false]);
  s = rideReducer(s, { type: "stampProgress", taps: 0, you: true }); // late, out-of-order event
  assert.deepEqual([s.taps, s.youTapped], [1, true]);
});

test("a stamp lands on the stamp screen, then the recap, then back to riding with the quest cleared", () => {
  let s = rideReducer(playing(), { type: "stampAwarded", stamp });
  assert.equal(s.phase, "stamp");
  assert.equal(s.stampsThisRide, 1);
  s = rideReducer(s, { type: "local/toRecap" });
  assert.equal(s.phase, "recap");
  s = rideReducer(s, { type: "local/finish" });
  assert.equal(s.phase, "riding");
  assert.equal(s.match, undefined);
  assert.equal(s.stamp, undefined);
  assert.equal(s.stampsThisRide, 1, "the ride keeps its count");
});

test("time up without a stamp goes to the recap", () => {
  assert.equal(rideReducer(playing(), { type: "missionEnded" }).phase, "recap");
  assert.equal(rideReducer(riding(), { type: "missionEnded" }).phase, "riding");
});

test("Not now or a partner leaving before the stamp falls through, and OK goes back to riding", () => {
  let s = rideReducer(meeting(), { type: "cancelled", reason: "partner" });
  assert.equal(s.phase, "fellThrough");
  assert.equal(s.fellThroughReason, "partner");
  assert.equal(s.match, undefined);
  s = rideReducer(s, { type: "local/dismiss" });
  assert.equal(s.phase, "riding");
});

test("a cancel while just riding changes nothing", () => {
  const s = riding();
  assert.equal(rideReducer(s, { type: "cancelled", reason: "other" }), s);
});

test("reaching your stop ends the ride from any phase, and closing it keeps your mood", () => {
  let s = rideReducer(playing(), { type: "local/mood", mood: "talk" });
  s = rideReducer(s, { type: "rideEnded", reason: "stop" });
  assert.equal(s.phase, "rideOver");
  assert.equal(s.rideOverReason, "stop");
  assert.equal(rideModeOn(s), false);
  s = rideReducer(s, { type: "local/closeRideOver" });
  assert.equal(s.phase, "off");
  assert.equal(s.mood, "talk");
});

test("turning Ride Mode off yourself ends the ride as 'you'", () => {
  const s = rideReducer(meeting(), { type: "local/checkOut" });
  assert.equal(s.phase, "rideOver");
  assert.equal(s.rideOverReason, "you");
});

test("a ride-ended event when Ride Mode is already off is ignored", () => {
  assert.equal(rideReducer(initialRide, { type: "rideEnded", reason: "stop" }), initialRide);
});

test("status updates keep the check-in when the server leaves it out", () => {
  const s = rideReducer(riding(), { type: "rideStatus", ridersOnTrain: 5, delayed: true, delayMinutes: 4 });
  assert.equal(s.checkIn, checkIn);
  assert.deepEqual([s.ridersOnTrain, s.delayed, s.delayMinutes], [5, true, 4]);
});

test("going offline and back only flips the banner", () => {
  const s = rideReducer(meeting(), { type: "connection", online: false });
  assert.equal(s.online, false);
  assert.equal(s.phase, "meet");
});
