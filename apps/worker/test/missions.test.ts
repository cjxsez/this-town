import test from "node:test";
import assert from "node:assert/strict";
import { DECK, SLOT_NAMES, templateById, type MissionTemplate } from "../src/missions/deck";
import { fillText, slotValuesFor, toMission } from "../src/missions/fill";
import { effectiveWeight, fitsBefore, isRepeat, RARE_WEIGHT_FACTOR, selectMission } from "../src/missions/select";
import { room } from "./fixtures";

const tpl = (id: string, patch: Partial<MissionTemplate> = {}): MissionTemplate => ({
  id,
  category: "create",
  title: id,
  prompt: id,
  minSeconds: 60,
  rare: false,
  weight: 1,
  ...patch,
});

const base = { availableSec: 120, lateBonusUnlocked: false, userHistories: [], pairHistory: [], random: () => 0 };

// ---- the curated deck itself ----

test("every deck template has a unique id and only uses known slots", () => {
  const ids = new Set<string>();
  for (const t of DECK) {
    assert.ok(!ids.has(t.id), `duplicate id ${t.id}`);
    ids.add(t.id);
    for (const [, slot] of `${t.title} ${t.prompt}`.matchAll(/\{(\w+)\}/g)) {
      assert.ok((SLOT_NAMES as readonly string[]).includes(slot!), `${t.id} uses unknown slot {${slot}}`);
    }
    assert.ok(t.minSeconds > 0 && t.weight > 0, `${t.id} needs positive minSeconds and weight`);
  }
});

test("the deck has missions short enough for the shortest segment and a late-train bonus", () => {
  assert.ok(DECK.some((t) => t.minSeconds <= 60 && t.category !== "late-bonus"));
  assert.ok(DECK.some((t) => t.category === "late-bonus"));
});

test("templateById finds deck entries", () => {
  assert.equal(templateById(DECK[0]!.id), DECK[0]);
  assert.equal(templateById("nope"), undefined);
});

// ---- filling slots ----

test("fillText replaces known slots and leaves unknown braces alone", () => {
  const values = { station: "Hynes", lastStation: "Kenmore", line: "Green", terminus: "Gov Ctr", color: "orange" } as const;
  assert.equal(fillText("Rename {station} on the {line} Line", values), "Rename Hynes on the Green Line");
  assert.equal(fillText("{mystery} stays", values), "{mystery} stays");
});

test("slot values come from the next stop, the last stop, the line and the terminus", () => {
  const v = slotValuesFor(room(), "pink");
  assert.deepEqual(v, { station: "Stop B", lastStation: "Stop A", line: "Orange", terminus: "Stop E", color: "pink" });
});

test("Green Line branches all read as Green, and a room with no trip says T", () => {
  const green = room();
  green.trip = { ...green.trip!, line: "Green-D" };
  assert.equal(slotValuesFor(green, "blue").line, "Green");
  assert.equal(slotValuesFor(room({ trip: null }), "blue").line, "T");
});

test("toMission fills the template and keeps its category and rarity", () => {
  const m = toMission(tpl("x", { title: "At {station}", prompt: "Go", rare: true, category: "spot" }), slotValuesFor(room(), "green"), "ses_1", 99);
  assert.deepEqual(m, { sessionId: "ses_1", templateId: "x", category: "spot", title: "At Stop B", prompt: "Go", endsAt: 99, rare: true });
});

// ---- selection ----

test("a mission fits only if there is at least its minimum time before the stop", () => {
  assert.equal(fitsBefore(tpl("a", { minSeconds: 60 }), 60), true);
  assert.equal(fitsBefore(tpl("a", { minSeconds: 61 }), 60), false);
});

test("a repeat is anything the pair did or either rider did recently", () => {
  const t = tpl("t");
  assert.equal(isRepeat(t, { ...base, pairHistory: ["t"] }), true);
  assert.equal(isRepeat(t, { ...base, userHistories: [[], ["t"]] }), true);
  assert.equal(isRepeat(t, base), false);
});

test("rare regular missions are picked less often; late-bonus ones keep their weight", () => {
  assert.equal(effectiveWeight(tpl("r", { rare: true, weight: 2 })), 2 * RARE_WEIGHT_FACTOR);
  assert.equal(effectiveWeight(tpl("l", { rare: true, weight: 2, category: "late-bonus" })), 2);
});

test("nothing fits when there is no time, so the pair waits for the next segment", () => {
  assert.equal(selectMission({ ...base, deck: [tpl("a", { minSeconds: 90 })], availableSec: 30 }), null);
});

test("fresh templates are preferred over repeats", () => {
  const deck = [tpl("done"), tpl("new")];
  assert.equal(selectMission({ ...base, deck, pairHistory: ["done"] })?.id, "new");
});

test("if every fitting template is one a rider did recently, one of those is still given", () => {
  assert.equal(selectMission({ ...base, deck: [tpl("done")], userHistories: [["done"], []] })?.id, "done");
});

test("a pair never gets a template twice, even when nothing else fits", () => {
  assert.equal(selectMission({ ...base, deck: [tpl("done")], pairHistory: ["done"] }), null);
  assert.equal(selectMission({ ...base, deck: [tpl("done"), tpl("rider-did")], pairHistory: ["done"], userHistories: [["rider-did"], []] })?.id, "rider-did");
});

test("the late-train bonus also never repeats for a pair", () => {
  const deck = [tpl("bonus", { category: "late-bonus" }), tpl("reg")];
  assert.equal(selectMission({ ...base, deck, lateBonusUnlocked: true, pairHistory: ["bonus"] })?.id, "reg");
});

test("an unlocked late-train bonus wins over regular missions", () => {
  const deck = [tpl("reg"), tpl("bonus", { category: "late-bonus", rare: true })];
  assert.equal(selectMission({ ...base, deck, lateBonusUnlocked: true })?.id, "bonus");
  assert.equal(selectMission({ ...base, deck, lateBonusUnlocked: false })?.id, "reg");
});

test("the pick follows the weights", () => {
  const deck = [tpl("light", { weight: 1 }), tpl("heavy", { weight: 3 })];
  assert.equal(selectMission({ ...base, deck, random: () => 0.1 })?.id, "light"); // 0.4 of 4 lands in the first 1
  assert.equal(selectMission({ ...base, deck, random: () => 0.5 })?.id, "heavy");
});

test("missions always come from the deck: selecting from the real deck returns a deck template", () => {
  const t = selectMission({ ...base, availableSec: 600, random: Math.random });
  assert.ok(t && DECK.includes(t));
});
