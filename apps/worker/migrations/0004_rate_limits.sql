-- 0004_rate_limits.sql: fixed-window request counters for the routes that need no login
-- (src/lib/rateLimit.ts). key = "<bucket>:<ip or email>". Rows past their window are
-- reset in place on the next hit and swept now and then.

CREATE TABLE rate_limits (
  key           TEXT PRIMARY KEY,
  window_start  INTEGER NOT NULL,
  count         INTEGER NOT NULL
);
