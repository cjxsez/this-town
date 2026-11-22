import test from "node:test";
import assert from "node:assert/strict";
import { DELETE_MET_PAIRS_FOR_TRIP_SQL, metPairsForTripDelete } from "../src/db/queries";

test("metPairsForTripDelete scopes the wipe to one trip via checkins", () => {
  const { sql, tripId } = metPairsForTripDelete("demo-trip-1");
  assert.equal(tripId, "demo-trip-1");
  assert.equal(sql, DELETE_MET_PAIRS_FOR_TRIP_SQL);
  assert.match(sql, /DELETE FROM met_pairs/i);
  assert.match(sql, /FROM checkins/i);
  assert.match(sql, /trip_id = \?1/);
  // Both sides of the pair must have checked in on that trip.
  assert.match(sql, /user_id = met_pairs\.user_a/);
  assert.match(sql, /user_id = met_pairs\.user_b/);
  // No bare DELETE without the trip filter.
  assert.doesNotMatch(sql, /DELETE FROM met_pairs\s*;/i);
});
