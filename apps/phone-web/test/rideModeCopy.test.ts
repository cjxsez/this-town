import test from "node:test";
import assert from "node:assert/strict";
import {
  checkInEndsHint,
  checkInPlayStep,
  destinationHint,
  glassesShowsBlurb,
  landingPitch,
  passportRareFootnote,
  recapEyebrow,
  recapNoStamp,
  recapStillRiding,
  rideModeEndsRule,
  rideModeMissionRule,
  rideOverEmpty,
  ridingStayOnHint,
  tapAlreadyMeeting,
  tapMeetingStarts,
} from "../src/lib/rideModeCopy";

test("destinationHint: mission mode mentions missions before a stop", () => {
  assert.match(destinationHint(false), /missions always end before a stop/);
});

test("destinationHint: games-only skips mission wording", () => {
  assert.doesNotMatch(destinationHint(true), /mission/i);
  assert.match(destinationHint(true), /phones or glasses/i);
});

test("rideModeMissionRule and ends rule switch on gamesOnly", () => {
  assert.match(rideModeMissionRule(false), /short mission/);
  assert.match(rideModeMissionRule(true), /games/);
  assert.match(rideModeEndsRule("Hynes", false), /turns off by itself at Hynes/);
  assert.match(rideModeEndsRule("Hynes", true), /stays on until you turn it off/);
});

test("ridingStayOnHint keeps the other-riders prefix", () => {
  assert.match(ridingStayOnHint(3, "Hynes", false), /2 other riders/);
  assert.match(ridingStayOnHint(3, "Hynes", false), /turns off at Hynes/);
  assert.match(ridingStayOnHint(3, "Hynes", true), /stays on until you turn it off/);
  assert.doesNotMatch(ridingStayOnHint(1, "Hynes", true), /turns off at/);
});

test("recap copy keeps mission/before-stop lines only when missions are on", () => {
  assert.equal(recapEyebrow(true, false), "Quest complete");
  assert.equal(recapEyebrow(true, true), "Games complete");
  assert.match(recapNoStamp(false), /before the stop/);
  assert.doesNotMatch(recapNoStamp(true), /mission|stop/i);
  assert.match(recapStillRiding("Hynes", false), /until Hynes/);
  assert.doesNotMatch(recapStillRiding("Hynes", true), /until Hynes|mission/i);
});

test("ride over, passport, check-in, tap, landing, glasses blurbs are mode-aware", () => {
  assert.match(rideOverEmpty(false), /No quest/);
  assert.match(rideOverEmpty(true), /No stamp/);
  assert.doesNotMatch(rideOverEmpty(true), /quest|mission/i);
  assert.match(passportRareFootnote(false), /late-bonus mission/);
  assert.doesNotMatch(passportRareFootnote(true), /mission/i);
  assert.match(checkInPlayStep(false), /quick mission/);
  assert.doesNotMatch(checkInPlayStep(true), /mission/i);
  assert.match(checkInEndsHint(false), /turns off at your stop/);
  assert.match(checkInEndsHint(true), /stays on until you turn it off/);
  assert.match(tapMeetingStarts(false), /mission starts/);
  assert.doesNotMatch(tapMeetingStarts(true), /mission/i);
  assert.match(tapAlreadyMeeting("1412", false), /mission starts/);
  assert.doesNotMatch(tapAlreadyMeeting("1412", true), /mission/i);
  assert.match(landingPitch(false), /before your stop/);
  assert.doesNotMatch(landingPitch(true), /before your stop|mission/i);
  assert.match(glassesShowsBlurb(false), /the mission and your stamp/);
  assert.match(glassesShowsBlurb(true), /the games and your stamp/);
  assert.doesNotMatch(glassesShowsBlurb(true), /mission/i);
});