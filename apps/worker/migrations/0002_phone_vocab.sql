-- 0002_phone_vocab.sql: adopt the phone design's vocabulary (docs/decisions.md D14).
-- - users.social_battery: nod | chat | talk        (was nod | quick-chat | lets-talk)
-- - users.status:         local | student | visiting (was visitor)
-- - users.interests:      phone catalog ids (old tag values no longer parse; recreate test users)
-- - stamps.station_id:    stop id that matches the phone's station catalog
-- - checkins.boarded_stop / destination_stop now hold stop ids, not names (no schema change)
-- SQLite can't change a CHECK in place, so users is rebuilt. defer_foreign_keys keeps the
-- tables that reference users(id) intact during the swap.

PRAGMA defer_foreign_keys = on;

CREATE TABLE users_new (
  id              TEXT PRIMARY KEY,
  first_name      TEXT NOT NULL CHECK (length(first_name) BETWEEN 1 AND 24),
  interests       TEXT NOT NULL,
  ask_me_about    TEXT NOT NULL DEFAULT '' CHECK (length(ask_me_about) <= 80),
  social_battery  TEXT NOT NULL CHECK (social_battery IN ('nod', 'chat', 'talk')),
  status          TEXT NOT NULL CHECK (status IN ('local', 'student', 'visiting')),
  languages       TEXT NOT NULL DEFAULT '[]',
  is_18_plus      INTEGER NOT NULL CHECK (is_18_plus = 1),
  ghost           INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL
);

INSERT INTO users_new
SELECT id, first_name, interests, ask_me_about,
       CASE social_battery WHEN 'quick-chat' THEN 'chat' WHEN 'lets-talk' THEN 'talk' ELSE social_battery END,
       CASE status WHEN 'visitor' THEN 'visiting' ELSE status END,
       languages, is_18_plus, ghost, created_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

PRAGMA defer_foreign_keys = off;

ALTER TABLE stamps ADD COLUMN station_id TEXT NOT NULL DEFAULT '';

-- Glasses polls must present the pollSecret returned with the code (protocol GlassesCodeRes).
ALTER TABLE glasses_codes ADD COLUMN poll_secret_hash TEXT NOT NULL DEFAULT '';
