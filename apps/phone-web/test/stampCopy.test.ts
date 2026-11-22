import test from "node:test";
import assert from "node:assert/strict";
import { stampActivityLabel } from "../src/lib/stampCopy";

test("games-playlist stamps say they played the three games together", () => {
  const label = stampActivityLabel("games-playlist");
  assert.ok(label);
  assert.equal(label.eyebrow, "GAMES");
  assert.match(label.title, /three games together/i);
});

test("ordinary mission ids leave activity to the catalog", () => {
  assert.equal(stampActivityLabel("excuse"), null);
  assert.equal(stampActivityLabel(""), null);
});
