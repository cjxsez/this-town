import test from "node:test";
import assert from "node:assert/strict";
import { stampFromRow } from "../src/db/queries";

test("stampFromRow maps match_id and template_id when present", () => {
  const s = stampFromRow({
    id: "stp_1",
    station: "Hynes",
    station_id: "hynes",
    line: "Green-D",
    partner_first_name: "Maya",
    rare: 0,
    awarded_at: 1_700_000_000_000,
    match_id: "mat_1",
    template_id: "games-playlist",
  });
  assert.equal(s.matchId, "mat_1");
  assert.equal(s.templateId, "games-playlist");
  assert.equal(s.partnerFirstName, "Maya");
});

test("stampFromRow omits matchId and templateId when the join left them null", () => {
  const s = stampFromRow({
    id: "stp_2",
    station: "Copley",
    station_id: "copley",
    line: "Green-B",
    partner_first_name: "Leo",
    rare: 1,
    awarded_at: 1,
    match_id: null,
    template_id: null,
  });
  assert.equal(s.matchId, undefined);
  assert.equal(s.templateId, undefined);
  assert.equal(s.rare, true);
});
