-- 0001_init.sql: durable records for Questline.
-- Live train state (who is checked in right now, current pairs, missions in flight) lives in
-- the TrainRoom Durable Object. D1 holds what must outlive a ride: users, auth sessions,
-- glasses link codes, check-in history, matches, mission sessions, stamps, met pairs,
-- blocks and reports. The room writes here on check-in/out, match, mission and stamp.
--
-- Conventions: ids are TEXT (see src/lib/ids.ts), timestamps are INTEGER epoch ms,
-- JSON arrays are stored as TEXT, booleans as INTEGER 0/1.
-- Pairs of users are stored normalized with user_a < user_b (and pair_key = "a:b").

-- ---------- users ----------
-- One row per rider. Mirrors protocol Profile. First names only, no photos, 18+ only.
CREATE TABLE users (
  id              TEXT PRIMARY KEY,
  first_name      TEXT NOT NULL CHECK (length(first_name) BETWEEN 1 AND 24),
  interests       TEXT NOT NULL,                       -- JSON array of InterestTag (3..5)
  ask_me_about    TEXT NOT NULL DEFAULT '' CHECK (length(ask_me_about) <= 80),
  social_battery  TEXT NOT NULL CHECK (social_battery IN ('nod', 'quick-chat', 'lets-talk')),
  status          TEXT NOT NULL CHECK (status IN ('local', 'student', 'visitor')),
  languages       TEXT NOT NULL DEFAULT '[]',          -- JSON array of strings (<= 5)
  is_18_plus      INTEGER NOT NULL CHECK (is_18_plus = 1),
  ghost           INTEGER NOT NULL DEFAULT 0,          -- remembered ghost preference for next check-in
  created_at      INTEGER NOT NULL
);

-- ---------- sessions (bearer tokens) ----------
-- Raw tokens are never stored: token_hash = sha256 hex of the bearer token.
-- client = which device holds it. Phone gets one at onboarding; glasses get one when linked.
CREATE TABLE sessions (
  token_hash    TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client        TEXT NOT NULL CHECK (client IN ('phone', 'glasses')),
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER,
  revoked_at    INTEGER
);
CREATE INDEX sessions_user ON sessions (user_id);

-- ---------- glasses_codes ----------
-- 4-digit codes shown on the lens. Lifecycle: created (user_id NULL) -> linked by the phone
-- (user_id, linked_at set) -> claimed by the glasses poll (claimed_at set, a glasses session
-- is minted at that moment and returned once). Expired rows are deleted before a new code is
-- issued so codes can be reused.
CREATE TABLE glasses_codes (
  code        TEXT PRIMARY KEY CHECK (length(code) = 4),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
  linked_at   INTEGER,
  claimed_at  INTEGER
);
CREATE INDEX glasses_codes_expires ON glasses_codes (expires_at);

-- ---------- checkins ----------
-- One row per (rider, trip, boarding). Moving cars updates `car` in place.
-- checked_out_at IS NULL means the rider is currently on that trip; the worker uses this
-- to route /ws/rider and /api/ride/* to the right TrainRoom.
CREATE TABLE checkins (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id           TEXT NOT NULL,
  line              TEXT NOT NULL,
  car               TEXT NOT NULL,
  boarded_stop      TEXT NOT NULL,
  destination_stop  TEXT NOT NULL,
  checked_in_at     INTEGER NOT NULL,
  checked_out_at    INTEGER,
  checkout_reason   TEXT CHECK (checkout_reason IN ('destination', 'ride-end', 'moved-trip', 'trip-ended'))
);
CREATE INDEX checkins_user_active ON checkins (user_id, checked_out_at);
CREATE INDEX checkins_user_line ON checkins (user_id, line, checked_in_at);
CREATE INDEX checkins_trip ON checkins (trip_id);

-- ---------- matches ----------
-- One row per pairing the room made. end_reason mirrors MatchClearedEvent.reason plus
-- 'reported' for matches closed by POST /api/report.
CREATE TABLE matches (
  id           TEXT PRIMARY KEY,
  trip_id      TEXT NOT NULL,
  line         TEXT NOT NULL,
  user_a       TEXT NOT NULL REFERENCES users(id),
  user_b       TEXT NOT NULL REFERENCES users(id),
  pair_key     TEXT NOT NULL,
  color        TEXT NOT NULL CHECK (color IN ('orange', 'green', 'blue', 'pink', 'yellow', 'purple')),
  meet_at_car  TEXT NOT NULL,
  walker_id    TEXT,                                   -- NULL when both are in the same car
  shared_tags  TEXT NOT NULL,                          -- JSON array of InterestTag
  why          TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  ended_at     INTEGER,
  end_reason   TEXT CHECK (end_reason IN ('partner-not-now', 'partner-left', 'stop-reached', 'mission-done', 'ghost', 'reported')),
  CHECK (user_a < user_b)
);
CREATE INDEX matches_user_a ON matches (user_a, created_at);
CREATE INDEX matches_user_b ON matches (user_b, created_at);
CREATE INDEX matches_pair ON matches (pair_key);

-- ---------- mission_sessions ----------
-- One row per mission shown on a kiosk. Drives anti-repeat:
--   per user: last 10 template_id via matches.user_a / user_b
--   per pair: every template_id for pair_key
CREATE TABLE mission_sessions (
  id           TEXT PRIMARY KEY,
  match_id     TEXT NOT NULL REFERENCES matches(id),
  pair_key     TEXT NOT NULL,
  template_id  TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('create', 'show-me', 'spot', 'quick-game', 'late-bonus')),
  rare         INTEGER NOT NULL DEFAULT 0,
  car          TEXT NOT NULL,
  station      TEXT,                                   -- next stop when the mission started
  started_at   INTEGER NOT NULL,
  ends_at      INTEGER NOT NULL,
  ended_at     INTEGER,
  end_reason   TEXT CHECK (end_reason IN ('stamped', 'time-up', 'cancelled'))
);
CREATE INDEX mission_sessions_match ON mission_sessions (match_id);
CREATE INDEX mission_sessions_pair ON mission_sessions (pair_key, template_id);
CREATE INDEX mission_sessions_started ON mission_sessions (started_at);

-- ---------- stamps ----------
-- One row per rider per stamped mission (so a stamped mission writes two rows).
CREATE TABLE stamps (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_user_id     TEXT NOT NULL,
  partner_first_name  TEXT NOT NULL,
  match_id            TEXT NOT NULL REFERENCES matches(id),
  session_id          TEXT NOT NULL REFERENCES mission_sessions(id),
  station             TEXT NOT NULL,
  line                TEXT NOT NULL,
  rare                INTEGER NOT NULL DEFAULT 0,
  awarded_at          INTEGER NOT NULL,
  UNIQUE (user_id, session_id)
);
CREATE INDEX stamps_user ON stamps (user_id, awarded_at);

-- ---------- met_pairs ----------
-- Written when a mission starts (the two actually met at the kiosk). Matching skips pairs
-- with last_met_at in the last 7 days. Passport "people met" counts rows per user.
CREATE TABLE met_pairs (
  user_a         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_met_at   INTEGER NOT NULL,
  last_met_at    INTEGER NOT NULL,
  times_met      INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);
CREATE INDEX met_pairs_user_b ON met_pairs (user_b);

-- ---------- blocks ----------
-- Directional; matching treats a block in either direction as a hard filter.
CREATE TABLE blocks (
  blocker_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX blocks_blocked ON blocks (blocked_id);

-- ---------- reports ----------
CREATE TABLE reports (
  id                TEXT PRIMARY KEY,
  reporter_id       TEXT NOT NULL REFERENCES users(id),
  reported_user_id  TEXT NOT NULL REFERENCES users(id),
  match_id          TEXT NOT NULL REFERENCES matches(id),
  reason            TEXT NOT NULL CHECK (length(reason) <= 280),
  blocked           INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL,
  reviewed_at       INTEGER
);
CREATE INDEX reports_reported ON reports (reported_user_id, created_at);
