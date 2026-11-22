import test from "node:test";
import assert from "node:assert/strict";
import { textWidth } from "../src/metrics";

test("text width scales with the font size", () => {
  assert.equal(textWidth("Kenmore", 20), textWidth("Kenmore", 10) * 2);
});

test("widths match the reference drawing's measured labels within 4%", () => {
  // widths measured on the reference at its 21.6 px label size
  for (const [text, px] of [["Wellington", 101], ["Community College", 194], ["Downtown Crossing", 195]] as const) {
    const w = textWidth(text, 21.6);
    assert.ok(Math.abs(w - px) / px < 0.04, `${text}: ${w} vs ${px}`);
  }
});

test("bold is wider than regular, and unknown characters still count", () => {
  assert.ok(textWidth("Alewife", 21.6, true) > textWidth("Alewife", 21.6));
  assert.ok(textWidth("é", 10) > 0);
});
