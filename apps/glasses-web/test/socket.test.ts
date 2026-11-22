import test from "node:test";
import assert from "node:assert/strict";
import { POLL_IDLE_MS, POLL_MATCHED_MS, ridePollIntervalMs } from "../src/lib/socket";

test("ridePollIntervalMs is 2 s with a match or mission, 5 s otherwise", () => {
  assert.equal(ridePollIntervalMs(null), POLL_IDLE_MS);
  assert.equal(ridePollIntervalMs({ match: null, mission: null }), POLL_IDLE_MS);
  assert.equal(ridePollIntervalMs({ match: { matchId: "m1" } as never, mission: null }), POLL_MATCHED_MS);
  assert.equal(ridePollIntervalMs({ match: null, mission: { sessionId: "s1" } as never }), POLL_MATCHED_MS);
});
