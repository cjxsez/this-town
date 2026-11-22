-- 0003_email_signin.sql: email accounts with one-time-code sign-in (docs/decisions.md D15).
-- - users.email: the account's verified email, lowercased. NULL for "Just play today" guests.
-- - login_codes: at most one live 6-digit code per email. Only sha256(email:code) is stored.
-- - signup_tickets: proof that a NEW email was verified, redeemed by POST /api/users.

ALTER TABLE users ADD COLUMN email TEXT;
CREATE UNIQUE INDEX users_email ON users (email);

CREATE TABLE login_codes (
  email       TEXT PRIMARY KEY,
  code_hash   TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,  -- wrong guesses against this code
  sent_at     INTEGER NOT NULL             -- for the resend cooldown
);

CREATE TABLE signup_tickets (
  ticket_hash  TEXT PRIMARY KEY,           -- sha256 of the raw ticket
  email        TEXT NOT NULL,
  expires_at   INTEGER NOT NULL,
  used_at      INTEGER
);
