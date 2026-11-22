import test from "node:test";
import assert from "node:assert/strict";
import { askMeAboutSimilarity, batteryMatch, carDistance, comparePairScores, scorePair } from "../src/matching/score";
import { rider, room } from "./fixtures";

const ORDER = ["1", "2", "3", "4"];

test("same car is distance 0, neighbours 1, and it is symmetric", () => {
  assert.equal(carDistance(ORDER, "2", "2"), 0);
  assert.equal(carDistance(ORDER, "1", "2"), 1);
  assert.equal(carDistance(ORDER, "4", "1"), 3);
  assert.equal(carDistance(ORDER, "1", "4"), carDistance(ORDER, "4", "1"));
});

test("a car missing from the train's order is far, so known neighbours win", () => {
  assert.ok(carDistance(ORDER, "1", "9") > carDistance(ORDER, "1", "4"));
});

test("ask-me-about similarity is word overlap, ignoring case, punctuation and short words", () => {
  assert.equal(askMeAboutSimilarity("Jazz records", "jazz RECORDS!"), 1);
  assert.equal(askMeAboutSimilarity("jazz", "baking"), 0);
  assert.equal(askMeAboutSimilarity("", "jazz"), 0);
  assert.equal(askMeAboutSimilarity("an ox", "an ox"), 0); // every word is too short to count
  assert.equal(askMeAboutSimilarity("jazz records", "jazz piano"), 1 / 3);
});

test("social battery: same is 1, one step apart 0.5, opposite ends 0", () => {
  assert.equal(batteryMatch("chat", "chat"), 1);
  assert.equal(batteryMatch("nod", "chat"), 0.5);
  assert.equal(batteryMatch("nod", "talk"), 0);
});

test("closeness beats interests: an adjacent pair with one shared tag ranks above a far pair with three", () => {
  const near = { carDistance: 1, interest: 1, battery: 0, novelty: 1 };
  const far = { carDistance: 3, interest: 3, battery: 1, novelty: 1 };
  assert.ok(comparePairScores(near, far) < 0);
});

test("on equal distance, more interest wins, then battery, then novelty", () => {
  const base = { carDistance: 1, interest: 2, battery: 0.5, novelty: 1 };
  assert.ok(comparePairScores({ ...base, interest: 3 }, base) < 0);
  assert.ok(comparePairScores({ ...base, battery: 1 }, base) < 0);
  assert.ok(comparePairScores({ ...base, novelty: 2 }, base) < 0);
  assert.equal(comparePairScores(base, { ...base }), 0);
});

test("scorePair counts shared tags plus ask-me-about overlap", () => {
  const a = rider("a", { car: "1", interests: ["ramen", "coffee", "anime"] });
  const b = rider("b", { car: "3", interests: ["coffee", "anime"] });
  a.profile.askMeAbout = "studio ghibli";
  b.profile.askMeAbout = "ghibli films";
  const s = scorePair(a, b, room());
  assert.equal(s.carDistance, 2);
  assert.equal(s.interest, 2 + 1 / 3);
});

test("novelty: never-met scores 1, met-twice scores 1/3", () => {
  const fresh = rider("a");
  const stranger = rider("b");
  const twice = rider("c", { metCounts: { a: 2 } });
  assert.equal(scorePair(fresh, stranger, room()).novelty, 1);
  assert.equal(scorePair(fresh, twice, room()).novelty, 1 / 3);
});

test("when everything else ties, never-met beats met-twice", () => {
  const me = rider("me", { car: "1", interests: ["ramen"] });
  const never = rider("never", { car: "2", interests: ["ramen"] });
  const twice = rider("twice", { car: "2", interests: ["ramen"], metCounts: { me: 2 } });
  const sNever = scorePair(me, never, room());
  const sTwice = scorePair(me, twice, room());
  assert.equal(sNever.carDistance, sTwice.carDistance);
  assert.equal(sNever.interest, sTwice.interest);
  assert.equal(sNever.battery, sTwice.battery);
  assert.ok(comparePairScores(sNever, sTwice) < 0);
});

test("closeness still wins over novelty: adjacent met-twice beats far never-met", () => {
  const me = rider("me", { car: "1", interests: ["ramen"] });
  const nearTwice = rider("near", { car: "2", interests: ["ramen"], metCounts: { me: 2 } });
  const farNever = rider("far", { car: "4", interests: ["ramen"] });
  const near = scorePair(me, nearTwice, room());
  const far = scorePair(me, farNever, room());
  assert.ok(near.carDistance < far.carDistance);
  assert.ok(near.novelty < far.novelty);
  assert.ok(comparePairScores(near, far) < 0);
});
