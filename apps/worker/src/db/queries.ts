/**
 * db/queries.ts: typed D1 helpers. The only module that writes SQL.
 *
 * Responsible for (tables from migrations/0001_init.sql):
 * - users: create, read profile, ghost preference, look up by email.
 * - login_codes, signup_tickets: email one-time-code sign-in (migrations/0003).
 * - sessions: mint bearer tokens (store sha256 only), resolve token -> userId.
 * - glasses_codes: issue 4-digit codes, link from phone, claim from glasses poll.
 * - checkins: active check-in lookup (used to route rider sockets / ride routes to the right
 *   TrainRoom), insert on check-in, update car on move, close on check-out, remembered
 *   destination per line.
 * - matches, mission_sessions: insert/end, anti-repeat history (user last 10, pair ever).
 * - stamps, met_pairs: award (two rows per stamp), met-recently lookups.
 * - blocks, reports.
 * - passport aggregate.
 *
 * Callers: routes/* (worker isolate) and rooms/TrainRoom.ts (DO, via this.env.DB).
 *
 * Protocol types: Profile, InterestTag, PairColor, MissionCategory, Stamp, Line, PassportRes.
 *
 * Stops are stored by id (protocol Stop.id, matching the phone's station catalog).
 */
import {
  Line as LineSchema,
  Profile,
  type CarId,
  type InterestTag,
  type Line,
  type MissionCategory,
  type PairColor,
  type Stamp,
} from "@questline/protocol";
import type { GlassesCodePollResT, GlassesCodeResT, PassportResT } from "../lib/api";
import { fourDigitCode, newId, newToken, orderedPair, sha256Hex, sixDigitCode } from "../lib/ids";
import {
  GLASSES_CODE_TTL_MS,
  LOGIN_CODE_MAX_ATTEMPTS,
  LOGIN_CODE_RESEND_MS,
  LOGIN_CODE_TTL_MS,
  SIGNUP_TICKET_TTL_MS,
  shouldTouchLastSeen,
} from "../lib/time";

// ---------- row types (snake_case, exactly as stored) ----------

export interface UserRow {
  id: string;
  first_name: string;
  interests: string;
  ask_me_about: string;
  social_battery: string;
  status: string;
  languages: string;
  is_18_plus: number;
  ghost: number;
  created_at: number;
  email: string | null;
}

export interface CheckinRow {
  id: string;
  user_id: string;
  trip_id: string;
  line: string;
  car: string;
  boarded_stop: string;
  destination_stop: string;
  checked_in_at: number;
  checked_out_at: number | null;
  checkout_reason: CheckoutReason | null;
}

export type CheckoutReason = "destination" | "ride-end" | "moved-trip" | "trip-ended";
export type MatchEndReason =
  | "partner-not-now"
  | "partner-left"
  | "stop-reached"
  | "mission-done"
  | "ghost"
  | "reported";
export type MissionEndReason = "stamped" | "time-up" | "cancelled";
export type SessionClient = "phone" | "glasses";

// ---------- camelCase shapes used by callers ----------

export interface ActiveCheckin {
  id: string;
  tripId: string;
  line: Line;
  car: CarId;
  boardedStop: string;
  destinationStop: string;
  checkedInAt: number;
}

export interface NewCheckin {
  id: string;
  userId: string;
  tripId: string;
  line: Line;
  car: CarId;
  boardedStop: string;
  destinationStop: string;
  checkedInAt: number;
}

export interface NewMatch {
  id: string;
  tripId: string;
  line: Line;
  userA: string;
  userB: string;
  pairKey: string;
  color: PairColor;
  meetAtCar: CarId;
  walkerId: string | null;
  sharedTags: InterestTag[];
  why: string;
  createdAt: number;
}

export interface MatchForUser {
  matchId: string;
  tripId: string;
  otherUserId: string;
  endedAt: number | null;
}

export interface NewMissionSession {
  id: string;
  matchId: string;
  pairKey: string;
  templateId: string;
  category: MissionCategory;
  rare: boolean;
  car: CarId;
  station: string | null;
  startedAt: number;
  endsAt: number;
}

export interface NewStamp {
  id: string;
  stationId: string;
  userId: string;
  partnerUserId: string;
  partnerFirstName: string;
  matchId: string;
  sessionId: string;
  station: string;
  line: Line;
  rare: boolean;
  awardedAt: number;
}

export interface NewReport {
  id: string;
  reporterId: string;
  reportedUserId: string;
  matchId: string;
  reason: string;
  blocked: boolean;
  createdAt: number;
}

export interface UserWithPrefs {
  userId: string;
  profile: Profile;
  ghost: boolean;
}

// ---------- mappers ----------

export function profileFromRow(row: UserRow): Profile {
  return Profile.parse({
    firstName: row.first_name,
    interests: JSON.parse(row.interests) as unknown,
    askMeAbout: row.ask_me_about,
    socialBattery: row.social_battery,
    status: row.status,
    languages: JSON.parse(row.languages) as unknown,
    is18Plus: row.is_18_plus === 1,
  });
}

export function stampFromRow(row: {
  id: string;
  station: string;
  station_id: string;
  line: string;
  partner_first_name: string;
  rare: number;
  awarded_at: number;
}): Stamp {
  return {
    id: row.id,
    stationId: row.station_id,
    station: row.station,
    line: LineSchema.parse(row.line),
    partnerFirstName: row.partner_first_name,
    rare: row.rare === 1,
    awardedAt: row.awarded_at,
  };
}

// ---------- users ----------

/** `email` is the verified account email; null makes a "Just play today" guest. */
export async function createUser(
  db: D1Database,
  profile: Profile,
  now: number,
  email: string | null = null,
): Promise<{ userId: string }> {
  const userId = newId("usr");
  await db
    .prepare(
      `INSERT INTO users (id, first_name, interests, ask_me_about, social_battery, status, languages, is_18_plus, created_at, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .bind(
      userId,
      profile.firstName,
      JSON.stringify(profile.interests),
      profile.askMeAbout,
      profile.socialBattery,
      profile.status,
      JSON.stringify(profile.languages),
      now,
      email,
    )
    .run();
  return { userId };
}

export async function getUser(db: D1Database, userId: string): Promise<UserWithPrefs | null> {
  const row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<UserRow>();
  if (!row) return null;
  return { userId: row.id, profile: profileFromRow(row), ghost: row.ghost === 1 };
}

export async function getUserIdByEmail(db: D1Database, email: string): Promise<string | null> {
  const row = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
  return row?.id ?? null;
}

export async function getUserEmail(db: D1Database, userId: string): Promise<string | null> {
  const row = await db.prepare("SELECT email FROM users WHERE id = ?").bind(userId).first<{ email: string | null }>();
  return row?.email ?? null;
}

/**
 * Gives a guest a verified email. "taken" when another account has it (also when a
 * concurrent request won the unique index), "has-email" when this rider already has one.
 */
export async function attachEmail(db: D1Database, userId: string, email: string): Promise<"ok" | "taken" | "has-email"> {
  const owner = await getUserIdByEmail(db, email);
  if (owner && owner !== userId) return "taken";
  if (owner === userId) return "ok";
  try {
    const res = await db.prepare("UPDATE users SET email = ? WHERE id = ? AND email IS NULL").bind(email, userId).run();
    return res.meta.changes === 1 ? "ok" : "has-email";
  } catch (e) {
    if (String(e).includes("UNIQUE")) return "taken";
    throw e;
  }
}

// ---------- email sign-in ----------

const loginCodeHash = (email: string, code: string) => sha256Hex(`${email}:${code}`);

/** True while the last code to `email` is inside the resend cooldown. */
export async function loginCodeTooSoon(db: D1Database, email: string, now: number): Promise<boolean> {
  const row = await db.prepare("SELECT sent_at FROM login_codes WHERE email = ?").bind(email).first<{ sent_at: number }>();
  return !!row && now - row.sent_at < LOGIN_CODE_RESEND_MS;
}

/**
 * Issue a fresh 6-digit code for `email`, replacing any earlier one. Returns null when a code
 * went out less than LOGIN_CODE_RESEND_MS ago (the caller answers 429).
 */
export async function issueLoginCode(db: D1Database, email: string, now: number): Promise<string | null> {
  const prev = await db.prepare("SELECT sent_at FROM login_codes WHERE email = ?").bind(email).first<{ sent_at: number }>();
  if (prev && now - prev.sent_at < LOGIN_CODE_RESEND_MS) return null;
  const code = sixDigitCode();
  await db
    .prepare(
      `INSERT INTO login_codes (email, code_hash, expires_at, attempts, sent_at) VALUES (?, ?, ?, 0, ?)
       ON CONFLICT (email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at,
         attempts = 0, sent_at = excluded.sent_at`,
    )
    .bind(email, await loginCodeHash(email, code), now + LOGIN_CODE_TTL_MS, now)
    .run();
  return code;
}

/** Forget the code, e.g. when the email could not be sent, so a retry isn't blocked by the cooldown. */
export async function deleteLoginCode(db: D1Database, email: string): Promise<void> {
  await db.prepare("DELETE FROM login_codes WHERE email = ?").bind(email).run();
}

export type LoginCodeCheck = "ok" | "wrong-code" | "expired" | "too-many-attempts";

/** Checks a code. A correct code is used up; a wrong one counts against LOGIN_CODE_MAX_ATTEMPTS. */
export async function checkLoginCode(db: D1Database, email: string, code: string, now: number): Promise<LoginCodeCheck> {
  const row = await db
    .prepare("SELECT code_hash, expires_at, attempts FROM login_codes WHERE email = ?")
    .bind(email)
    .first<{ code_hash: string; expires_at: number; attempts: number }>();
  if (!row || row.expires_at <= now) return "expired";
  if (row.attempts >= LOGIN_CODE_MAX_ATTEMPTS) return "too-many-attempts";
  if (row.code_hash === (await loginCodeHash(email, code))) {
    // Single use: only the request that actually deletes the row wins.
    const del = await db.prepare("DELETE FROM login_codes WHERE email = ? AND code_hash = ?").bind(email, row.code_hash).run();
    return del.meta.changes === 1 ? "ok" : "expired";
  }
  await db.prepare("UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?").bind(email).run();
  return row.attempts + 1 >= LOGIN_CODE_MAX_ATTEMPTS ? "too-many-attempts" : "wrong-code";
}

/** A verified new email gets a ticket that POST /api/users redeems. Returns the raw ticket. */
export async function createSignupTicket(db: D1Database, email: string, now: number): Promise<string> {
  const ticket = newToken();
  await db
    .prepare("INSERT INTO signup_tickets (ticket_hash, email, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256Hex(ticket), email, now + SIGNUP_TICKET_TTL_MS)
    .run();
  return ticket;
}

/** Marks the ticket used and returns its email, or null if it is unknown, used or expired. */
export async function redeemSignupTicket(db: D1Database, ticket: string, now: number): Promise<string | null> {
  const row = await db
    .prepare(
      `UPDATE signup_tickets SET used_at = ? WHERE ticket_hash = ? AND used_at IS NULL AND expires_at > ?
       RETURNING email`,
    )
    .bind(now, await sha256Hex(ticket), now)
    .first<{ email: string }>();
  return row?.email ?? null;
}

export async function setUserGhost(db: D1Database, userId: string, ghost: boolean): Promise<void> {
  await db.prepare("UPDATE users SET ghost = ? WHERE id = ?").bind(ghost ? 1 : 0, userId).run();
}

// ---------- sessions ----------

/** Mints a token, stores sha256(token), returns the raw token (shown once). */
export async function createSession(
  db: D1Database,
  userId: string,
  client: SessionClient,
  now: number,
): Promise<string> {
  const token = newToken();
  await db
    .prepare("INSERT INTO sessions (token_hash, user_id, client, created_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256Hex(token), userId, client, now)
    .run();
  return token;
}

/**
 * Hashes the token and looks it up (revoked_at IS NULL).
 * Touches sessions.last_seen_at at most once per LAST_SEEN_TOUCH_MS.
 */
export async function userIdForToken(db: D1Database, token: string, now = Date.now()): Promise<string | null> {
  const hash = await sha256Hex(token);
  const row = await db
    .prepare("SELECT user_id, last_seen_at FROM sessions WHERE token_hash = ? AND revoked_at IS NULL")
    .bind(hash)
    .first<{ user_id: string; last_seen_at: number | null }>();
  if (!row) return null;
  if (shouldTouchLastSeen(row.last_seen_at, now)) {
    await db.prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?").bind(now, hash).run();
  }
  return row.user_id;
}

export async function hasGlassesSession(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 AS x FROM sessions WHERE user_id = ? AND client = 'glasses' AND revoked_at IS NULL LIMIT 1")
    .bind(userId)
    .first();
  return row !== null;
}

// ---------- glasses_codes ----------

export async function createGlassesCode(db: D1Database, now: number): Promise<GlassesCodeResT> {
  await db.prepare("DELETE FROM glasses_codes WHERE expires_at <= ?").bind(now).run();
  const expiresAt = now + GLASSES_CODE_TTL_MS;
  const pollSecret = newToken();
  const secretHash = await sha256Hex(pollSecret);
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = fourDigitCode();
    const res = await db
      .prepare(
        "INSERT OR IGNORE INTO glasses_codes (code, poll_secret_hash, created_at, expires_at) VALUES (?, ?, ?, ?)",
      )
      .bind(code, secretHash, now, expiresAt)
      .run();
    if (res.meta.changes === 1) return { code, pollSecret, expiresAt };
  }
  throw new Error("could not allocate a glasses code");
}

/** null = unknown, expired or wrong secret (route answers 410). */
export async function pollGlassesCode(
  db: D1Database,
  code: string,
  pollSecret: string,
  now: number,
): Promise<GlassesCodePollResT | null> {
  const row = await db
    .prepare("SELECT user_id, expires_at, claimed_at, poll_secret_hash FROM glasses_codes WHERE code = ?")
    .bind(code)
    .first<{ user_id: string | null; expires_at: number; claimed_at: number | null; poll_secret_hash: string }>();
  if (!row || row.poll_secret_hash !== (await sha256Hex(pollSecret))) return null;
  if (!row.user_id) return row.expires_at > now ? { linked: false } : null;
  if (row.claimed_at !== null) return null; // token was already handed out once
  const claim = await db
    .prepare("UPDATE glasses_codes SET claimed_at = ? WHERE code = ? AND claimed_at IS NULL")
    .bind(now, code)
    .run();
  if (claim.meta.changes !== 1) return null;
  const token = await createSession(db, row.user_id, "glasses", now);
  return { linked: true, token };
}

/** Returns false if the code is unknown, expired or already linked. */
export async function linkGlassesCode(db: D1Database, code: string, userId: string, now: number): Promise<boolean> {
  const res = await db
    .prepare("UPDATE glasses_codes SET user_id = ?, linked_at = ? WHERE code = ? AND expires_at > ? AND user_id IS NULL")
    .bind(userId, now, code, now)
    .run();
  return res.meta.changes === 1;
}

// ---------- checkins ----------

export async function activeCheckin(db: D1Database, userId: string): Promise<ActiveCheckin | null> {
  const row = await db
    .prepare("SELECT * FROM checkins WHERE user_id = ? AND checked_out_at IS NULL ORDER BY checked_in_at DESC LIMIT 1")
    .bind(userId)
    .first<CheckinRow>();
  if (!row) return null;
  return {
    id: row.id,
    tripId: row.trip_id,
    line: LineSchema.parse(row.line),
    car: row.car,
    boardedStop: row.boarded_stop,
    destinationStop: row.destination_stop,
    checkedInAt: row.checked_in_at,
  };
}

export async function insertCheckin(db: D1Database, c: NewCheckin): Promise<void> {
  await db
    .prepare(
      `INSERT INTO checkins (id, user_id, trip_id, line, car, boarded_stop, destination_stop, checked_in_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(c.id, c.userId, c.tripId, c.line, c.car, c.boardedStop, c.destinationStop, c.checkedInAt)
    .run();
}

export async function updateCheckinCar(db: D1Database, checkinId: string, car: CarId): Promise<void> {
  await db.prepare("UPDATE checkins SET car = ? WHERE id = ?").bind(car, checkinId).run();
}

export async function closeCheckin(db: D1Database, checkinId: string, reason: CheckoutReason, at: number): Promise<void> {
  await db
    .prepare("UPDATE checkins SET checked_out_at = ?, checkout_reason = ? WHERE id = ? AND checked_out_at IS NULL")
    .bind(at, reason, checkinId)
    .run();
}

/** Last destination (stop id) this rider picked on this line, for "remembered from last time". */
export async function lastDestination(db: D1Database, userId: string, line: Line): Promise<string | null> {
  const row = await db
    .prepare("SELECT destination_stop FROM checkins WHERE user_id = ? AND line = ? ORDER BY checked_in_at DESC LIMIT 1")
    .bind(userId, line)
    .first<{ destination_stop: string }>();
  return row?.destination_stop ?? null;
}

// ---------- matches ----------

export async function insertMatch(db: D1Database, m: NewMatch): Promise<void> {
  const [a, b] = orderedPair(m.userA, m.userB);
  await db
    .prepare(
      `INSERT INTO matches (id, trip_id, line, user_a, user_b, pair_key, color, meet_at_car, walker_id, shared_tags, why, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(m.id, m.tripId, m.line, a, b, m.pairKey, m.color, m.meetAtCar, m.walkerId, JSON.stringify(m.sharedTags), m.why, m.createdAt)
    .run();
}

export async function endMatch(db: D1Database, matchId: string, reason: MatchEndReason, at: number): Promise<void> {
  await db
    .prepare("UPDATE matches SET ended_at = ?, end_reason = ? WHERE id = ? AND ended_at IS NULL")
    .bind(at, reason, matchId)
    .run();
}

/** Null unless userId is one side of the match. */
export async function getMatchForUser(db: D1Database, matchId: string, userId: string): Promise<MatchForUser | null> {
  const row = await db
    .prepare("SELECT id, trip_id, user_a, user_b, ended_at FROM matches WHERE id = ? AND (user_a = ? OR user_b = ?)")
    .bind(matchId, userId, userId)
    .first<{ id: string; trip_id: string; user_a: string; user_b: string; ended_at: number | null }>();
  if (!row) return null;
  return {
    matchId: row.id,
    tripId: row.trip_id,
    otherUserId: row.user_a === userId ? row.user_b : row.user_a,
    endedAt: row.ended_at,
  };
}

// ---------- mission_sessions ----------

export async function insertMissionSession(db: D1Database, s: NewMissionSession): Promise<void> {
  await db
    .prepare(
      `INSERT INTO mission_sessions (id, match_id, pair_key, template_id, category, rare, car, station, started_at, ends_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(s.id, s.matchId, s.pairKey, s.templateId, s.category, s.rare ? 1 : 0, s.car, s.station, s.startedAt, s.endsAt)
    .run();
}

export async function endMissionSession(db: D1Database, sessionId: string, reason: MissionEndReason, at: number): Promise<void> {
  await db
    .prepare("UPDATE mission_sessions SET ended_at = ?, end_reason = ? WHERE id = ? AND ended_at IS NULL")
    .bind(at, reason, sessionId)
    .run();
}

/** Template ids from this rider's last `limit` missions, newest first. */
export async function recentTemplatesForUser(db: D1Database, userId: string, limit = 10): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT s.template_id FROM mission_sessions s JOIN matches m ON m.id = s.match_id
       WHERE m.user_a = ?1 OR m.user_b = ?1 ORDER BY s.started_at DESC LIMIT ?2`,
    )
    .bind(userId, limit)
    .all<{ template_id: string }>();
  return results.map((r) => r.template_id);
}

/** Every template id this pair has ever done. */
export async function templatesForPair(db: D1Database, pairKey: string): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT DISTINCT template_id FROM mission_sessions WHERE pair_key = ?")
    .bind(pairKey)
    .all<{ template_id: string }>();
  return results.map((r) => r.template_id);
}

// ---------- stamps + met_pairs ----------

export async function insertStamps(db: D1Database, stamps: NewStamp[]): Promise<void> {
  if (stamps.length === 0) return;
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO stamps (id, user_id, partner_user_id, partner_first_name, match_id, session_id, station, station_id, line, rare, awarded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  await db.batch(
    stamps.map((s) =>
      stmt.bind(s.id, s.userId, s.partnerUserId, s.partnerFirstName, s.matchId, s.sessionId, s.station, s.stationId, s.line, s.rare ? 1 : 0, s.awardedAt),
    ),
  );
}

/** Upsert met_pairs (times_met + 1, last_met_at = at). */
export async function recordMet(db: D1Database, a: string, b: string, at: number): Promise<void> {
  const [x, y] = orderedPair(a, b);
  await db
    .prepare(
      `INSERT INTO met_pairs (user_a, user_b, first_met_at, last_met_at) VALUES (?1, ?2, ?3, ?3)
       ON CONFLICT(user_a, user_b) DO UPDATE SET last_met_at = ?3, times_met = times_met + 1`,
    )
    .bind(x, y, at)
    .run();
}

/** User ids this rider met at or after sinceMs. */
export async function metSince(db: D1Database, userId: string, sinceMs: number): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT CASE WHEN user_a = ?1 THEN user_b ELSE user_a END AS other
       FROM met_pairs WHERE (user_a = ?1 OR user_b = ?1) AND last_met_at >= ?2`,
    )
    .bind(userId, sinceMs)
    .all<{ other: string }>();
  return results.map((r) => r.other);
}

/**
 * Lifetime times_met for this rider vs a set of other user ids (e.g. everyone else
 * currently in the TrainRoom). Missing partners are omitted (treat as 0).
 */
export async function metCountsFor(
  db: D1Database,
  userId: string,
  others: readonly string[],
): Promise<Record<string, number>> {
  if (others.length === 0) return {};
  const want = new Set(others);
  const { results } = await db
    .prepare(
      `SELECT CASE WHEN user_a = ?1 THEN user_b ELSE user_a END AS other, times_met
       FROM met_pairs WHERE user_a = ?1 OR user_b = ?1`,
    )
    .bind(userId)
    .all<{ other: string; times_met: number }>();
  const out: Record<string, number> = {};
  for (const r of results) {
    if (want.has(r.other)) out[r.other] = r.times_met;
  }
  return out;
}

// ---------- blocks + reports ----------

/** Users this rider blocked or was blocked by. */
export async function blockedEither(db: D1Database, userId: string): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT blocked_id AS other FROM blocks WHERE blocker_id = ?1 UNION SELECT blocker_id FROM blocks WHERE blocked_id = ?1")
    .bind(userId)
    .all<{ other: string }>();
  return results.map((r) => r.other);
}

export async function insertBlock(db: D1Database, blockerId: string, blockedId: string, at: number): Promise<void> {
  await db
    .prepare("INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)")
    .bind(blockerId, blockedId, at)
    .run();
}

export async function deleteBlock(db: D1Database, blockerId: string, blockedId: string): Promise<void> {
  await db.prepare("DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?").bind(blockerId, blockedId).run();
}

export async function insertReport(db: D1Database, r: NewReport): Promise<void> {
  await db
    .prepare(
      "INSERT INTO reports (id, reporter_id, reported_user_id, match_id, reason, blocked, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(r.id, r.reporterId, r.reportedUserId, r.matchId, r.reason, r.blocked ? 1 : 0, r.createdAt)
    .run();
}

// ---------- passport ----------

export async function passportFor(db: D1Database, userId: string): Promise<PassportResT> {
  const [stamps, met, lines] = await db.batch([
    db.prepare("SELECT * FROM stamps WHERE user_id = ? ORDER BY awarded_at DESC").bind(userId),
    db.prepare("SELECT COUNT(*) AS n FROM met_pairs WHERE user_a = ?1 OR user_b = ?1").bind(userId),
    db.prepare("SELECT line, COUNT(*) AS n FROM stamps WHERE user_id = ? GROUP BY line").bind(userId),
  ]);
  const byLine: Record<string, number> = {};
  for (const r of (lines?.results ?? []) as { line: string; n: number }[]) byLine[r.line] = r.n;
  return {
    stamps: ((stamps?.results ?? []) as Parameters<typeof stampFromRow>[0][]).map(stampFromRow),
    peopleMet: ((met?.results?.[0] as { n: number } | undefined)?.n ?? 0),
    byLine,
  };
}

// ---------- profile edits, deletion, history ----------

export async function updateUser(db: D1Database, userId: string, p: Profile): Promise<void> {
  await db
    .prepare(
      "UPDATE users SET first_name = ?, interests = ?, ask_me_about = ?, social_battery = ?, status = ?, languages = ? WHERE id = ?",
    )
    .bind(p.firstName, JSON.stringify(p.interests), p.askMeAbout, p.socialBattery, p.status, JSON.stringify(p.languages), userId)
    .run();
}

export async function setUserBattery(db: D1Database, userId: string, battery: string): Promise<void> {
  await db.prepare("UPDATE users SET social_battery = ? WHERE id = ?").bind(battery, userId).run();
}

/**
 * "Delete my data". Matches and mission sessions stay (the other rider's stamps point at
 * them), but everything that identifies this rider goes: profile text, sessions, glasses
 * codes, their stamps, met pairs, blocks, and their first name on other riders' stamps.
 */
export async function scrubUser(db: D1Database, userId: string): Promise<void> {
  await db.batch([
    // Free the email too, so signing in with it later starts a fresh account.
    db.prepare("DELETE FROM login_codes WHERE email = (SELECT email FROM users WHERE id = ?1)").bind(userId),
    db.prepare("UPDATE users SET first_name = 'Deleted', ask_me_about = '', interests = '[]', languages = '[]', email = NULL WHERE id = ?1").bind(userId),
    db.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(userId),
    db.prepare("DELETE FROM glasses_codes WHERE user_id = ?1").bind(userId),
    db.prepare("DELETE FROM stamps WHERE user_id = ?1").bind(userId),
    db.prepare("UPDATE stamps SET partner_first_name = 'Someone' WHERE partner_user_id = ?1").bind(userId),
    db.prepare("DELETE FROM met_pairs WHERE user_a = ?1 OR user_b = ?1").bind(userId),
    db.prepare("DELETE FROM blocks WHERE blocker_id = ?1 OR blocked_id = ?1").bind(userId),
  ]);
}

export interface RecentMatchRow {
  matchId: string;
  partnerFirstName: string;
  color: PairColor;
  line: Line;
  at: number;
  stamped: boolean;
  /** Where this rider's stamp from the match was awarded; null without a stamp. */
  stationId: string | null;
  /** This rider blocked the partner. */
  blocked: boolean;
}

export async function recentMatches(db: D1Database, userId: string, limit = 20): Promise<RecentMatchRow[]> {
  const { results } = await db
    .prepare(
      `SELECT m.id, m.color, m.line, m.created_at, u.first_name,
              (SELECT s.station_id FROM stamps s WHERE s.match_id = m.id AND s.user_id = ?1 AND s.station_id <> ''
                ORDER BY s.awarded_at DESC LIMIT 1) AS station_id,
              EXISTS (SELECT 1 FROM stamps s WHERE s.match_id = m.id AND s.user_id = ?1) AS stamped,
              EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = ?1 AND b.blocked_id = u.id) AS blocked
       FROM matches m JOIN users u ON u.id = CASE WHEN m.user_a = ?1 THEN m.user_b ELSE m.user_a END
       WHERE m.user_a = ?1 OR m.user_b = ?1
       ORDER BY m.created_at DESC LIMIT ?2`,
    )
    .bind(userId, limit)
    .all<{
      id: string;
      color: string;
      line: string;
      created_at: number;
      first_name: string;
      station_id: string | null;
      stamped: number;
      blocked: number;
    }>();
  return results.map((r) => ({
    matchId: r.id,
    partnerFirstName: r.first_name,
    color: r.color as PairColor,
    line: LineSchema.parse(r.line),
    at: r.created_at,
    stamped: r.stamped === 1,
    stationId: r.station_id,
    blocked: r.blocked === 1,
  }));
}
