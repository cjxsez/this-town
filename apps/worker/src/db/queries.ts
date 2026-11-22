/**
 * db/queries.ts: typed D1 helpers. The only module that writes SQL.
 *
 * Responsible for (tables from migrations/0001_init.sql):
 * - users: create, read profile, ghost preference.
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
import { fourDigitCode, newId, newToken, orderedPair, sha256Hex } from "../lib/ids";
import { GLASSES_CODE_TTL_MS } from "../lib/time";

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

export async function createUser(db: D1Database, profile: Profile, now: number): Promise<{ userId: string }> {
  const userId = newId("usr");
  await db
    .prepare(
      `INSERT INTO users (id, first_name, interests, ask_me_about, social_battery, status, languages, is_18_plus, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
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
    )
    .run();
  return { userId };
}

export async function getUser(db: D1Database, userId: string): Promise<UserWithPrefs | null> {
  const row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<UserRow>();
  if (!row) return null;
  return { userId: row.id, profile: profileFromRow(row), ghost: row.ghost === 1 };
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

/** Hashes the token and looks it up (revoked_at IS NULL). */
export async function userIdForToken(db: D1Database, token: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT user_id FROM sessions WHERE token_hash = ? AND revoked_at IS NULL")
    .bind(await sha256Hex(token))
    .first<{ user_id: string }>();
  return row?.user_id ?? null;
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
    db.prepare("UPDATE users SET first_name = 'Deleted', ask_me_about = '', interests = '[]', languages = '[]' WHERE id = ?1").bind(userId),
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
}

export async function recentMatches(db: D1Database, userId: string, limit = 20): Promise<RecentMatchRow[]> {
  const { results } = await db
    .prepare(
      `SELECT m.id, m.color, m.line, m.created_at, u.first_name,
              EXISTS (SELECT 1 FROM stamps s WHERE s.match_id = m.id AND s.user_id = ?1) AS stamped
       FROM matches m JOIN users u ON u.id = CASE WHEN m.user_a = ?1 THEN m.user_b ELSE m.user_a END
       WHERE m.user_a = ?1 OR m.user_b = ?1
       ORDER BY m.created_at DESC LIMIT ?2`,
    )
    .bind(userId, limit)
    .all<{ id: string; color: string; line: string; created_at: number; first_name: string; stamped: number }>();
  return results.map((r) => ({
    matchId: r.id,
    partnerFirstName: r.first_name,
    color: r.color as PairColor,
    line: LineSchema.parse(r.line),
    at: r.created_at,
    stamped: r.stamped === 1,
  }));
}
