import test from "node:test";
import assert from "node:assert/strict";
import { LAST_SEEN_TOUCH_MS, shouldTouchLastSeen } from "../src/lib/time";

test("shouldTouchLastSeen is true when never seen or older than the window", () => {
  const now = 1_000_000;
  assert.equal(shouldTouchLastSeen(null, now), true);
  assert.equal(shouldTouchLastSeen(undefined, now), true);
  assert.equal(shouldTouchLastSeen(now - LAST_SEEN_TOUCH_MS, now), true);
  assert.equal(shouldTouchLastSeen(now - LAST_SEEN_TOUCH_MS - 1, now), true);
});

test("shouldTouchLastSeen is false inside the 10-minute window", () => {
  const now = 1_000_000;
  assert.equal(shouldTouchLastSeen(now, now), false);
  assert.equal(shouldTouchLastSeen(now - LAST_SEEN_TOUCH_MS + 1, now), false);
  assert.equal(shouldTouchLastSeen(now - 60_000, now), false);
});
