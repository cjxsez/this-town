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
 * TODO (every function below):
 * - Implement with db.prepare(...).bind(...).first/all/run. Use db.batch() for multi-row
 *   writes (stamps, check-out + match end).
 * - createGlassesCode: DELETE expired rows, then INSERT; retry on PK conflict (max ~5).
 * - pollGlassesCode: when linked and unclaimed, `UPDATE ... SET claimed_at = ? WHERE code = ?
 *   AND claimed_at IS NULL`; only if changes === 1 mint the glasses session and return it.
 * - Parse JSON columns (interests, languages, shared_tags) with the protocol schemas.
 */
import {
  Profile,
  type CarId,
  type InterestTag,
  type Line,
  type MissionCategory,
  type PairColor,
  type Stamp,
} from "@questline/protocol";
import type { GlassesCodePollResT, GlassesCodeResT, PassportResT } from "../lib/api";

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
  line: string;
  partner_first_name: string;
  rare: number;
  awarded_at: number;
}): Stamp {
  // TODO: validate line with the protocol Line schema instead of casting.
  return {
    id: row.id,
    station: row.station,
    line: row.line as Line,
    partnerFirstName: row.partner_first_name,
    rare: row.rare === 1,
    awardedAt: row.awarded_at,
  };
}

// ---------- users ----------

export async function createUser(db: D1Database, profile: Profile, now: number): Promise<{ userId: string }> {
  throw new Error("TODO: INSERT INTO users");
}

export async function getUser(db: D1Database, userId: string): Promise<UserWithPrefs | null> {
  throw new Error("TODO: SELECT * FROM users WHERE id = ?");
}

export async function setUserGhost(db: D1Database, userId: string, ghost: boolean): Promise<void> {
  throw new Error("TODO: UPDATE users SET ghost = ?");
}

// ---------- sessions ----------

/** Mints a token, stores sha256(token), returns the raw token (shown once). */
export async function createSession(
  db: D1Database,
  userId: string,
  client: SessionClient,
  now: number,
): Promise<string> {
  throw new Error("TODO: newToken(), sha256Hex(), INSERT INTO sessions");
}

/** Hashes the token and looks it up (revoked_at IS NULL). Optionally bumps last_seen_at. */
export async function userIdForToken(db: D1Database, token: string): Promise<string | null> {
  throw new Error("TODO: SELECT user_id FROM sessions WHERE token_hash = ? AND revoked_at IS NULL");
}

export async function hasGlassesSession(db: D1Database, userId: string): Promise<boolean> {
  throw new Error("TODO: SELECT 1 FROM sessions WHERE user_id = ? AND client = 'glasses' AND revoked_at IS NULL");
}

// ---------- glasses_codes ----------

export async function createGlassesCode(db: D1Database, now: number): Promise<GlassesCodeResT> {
  throw new Error("TODO: delete expired, fourDigitCode(), INSERT with retry; expiresAt = now + GLASSES_CODE_TTL_MS");
}

export async function pollGlassesCode(db: D1Database, code: string, now: number): Promise<GlassesCodePollResT> {
  throw new Error("TODO: linked && unclaimed -> claim + createSession(user, 'glasses'); else { linked: false }");
}

/** Returns false if the code is unknown, expired or already linked. */
export async function linkGlassesCode(db: D1Database, code: string, userId: string, now: number): Promise<boolean> {
  throw new Error("TODO: UPDATE glasses_codes SET user_id, linked_at WHERE code = ? AND expires_at > ? AND user_id IS NULL");
}

// ---------- checkins ----------

export async function activeCheckin(db: D1Database, userId: string): Promise<ActiveCheckin | null> {
  throw new Error("TODO: SELECT ... FROM checkins WHERE user_id = ? AND checked_out_at IS NULL ORDER BY checked_in_at DESC LIMIT 1");
}

export async function insertCheckin(db: D1Database, c: NewCheckin): Promise<void> {
  throw new Error("TODO: INSERT INTO checkins");
}

export async function updateCheckinCar(db: D1Database, checkinId: string, car: CarId): Promise<void> {
  throw new Error("TODO: UPDATE checkins SET car = ?");
}

export async function closeCheckin(db: D1Database, checkinId: string, reason: CheckoutReason, at: number): Promise<void> {
  throw new Error("TODO: UPDATE checkins SET checked_out_at, checkout_reason WHERE id = ? AND checked_out_at IS NULL");
}

/** Last destination this rider picked on this line, for "remembered from last time". */
export async function lastDestination(db: D1Database, userId: string, line: Line): Promise<string | null> {
  throw new Error("TODO: SELECT destination_stop FROM checkins WHERE user_id = ? AND line = ? ORDER BY checked_in_at DESC LIMIT 1");
}

// ---------- matches ----------

export async function insertMatch(db: D1Database, m: NewMatch): Promise<void> {
  throw new Error("TODO: INSERT INTO matches (user_a < user_b via orderedPair)");
}

export async function endMatch(db: D1Database, matchId: string, reason: MatchEndReason, at: number): Promise<void> {
  throw new Error("TODO: UPDATE matches SET ended_at, end_reason WHERE id = ? AND ended_at IS NULL");
}

/** Null unless userId is one side of the match. */
export async function getMatchForUser(db: D1Database, matchId: string, userId: string): Promise<MatchForUser | null> {
  throw new Error("TODO: SELECT ... FROM matches WHERE id = ? AND (user_a = ? OR user_b = ?)");
}

// ---------- mission_sessions ----------

export async function insertMissionSession(db: D1Database, s: NewMissionSession): Promise<void> {
  throw new Error("TODO: INSERT INTO mission_sessions");
}

export async function endMissionSession(db: D1Database, sessionId: string, reason: MissionEndReason, at: number): Promise<void> {
  throw new Error("TODO: UPDATE mission_sessions SET ended_at, end_reason");
}

/** Template ids from this rider's last `limit` missions, newest first. */
export async function recentTemplatesForUser(db: D1Database, userId: string, limit = 10): Promise<string[]> {
  throw new Error("TODO: JOIN matches ON match_id WHERE user_a = ?1 OR user_b = ?1 ORDER BY started_at DESC LIMIT ?2");
}

/** Every template id this pair has ever done. */
export async function templatesForPair(db: D1Database, pairKey: string): Promise<string[]> {
  throw new Error("TODO: SELECT DISTINCT template_id FROM mission_sessions WHERE pair_key = ?");
}

// ---------- stamps + met_pairs ----------

export async function insertStamps(db: D1Database, stamps: NewStamp[]): Promise<void> {
  throw new Error("TODO: db.batch of INSERT OR IGNORE INTO stamps");
}

/** Upsert met_pairs (times_met + 1, last_met_at = at). */
export async function recordMet(db: D1Database, a: string, b: string, at: number): Promise<void> {
  throw new Error("TODO: INSERT ... ON CONFLICT(user_a, user_b) DO UPDATE");
}

/** User ids this rider met at or after sinceMs. */
export async function metSince(db: D1Database, userId: string, sinceMs: number): Promise<string[]> {
  throw new Error("TODO: SELECT other side FROM met_pairs WHERE (user_a = ?1 OR user_b = ?1) AND last_met_at >= ?2");
}

// ---------- blocks + reports ----------

/** Users this rider blocked or was blocked by. */
export async function blockedEither(db: D1Database, userId: string): Promise<string[]> {
  throw new Error("TODO: SELECT blocked_id WHERE blocker_id = ? UNION SELECT blocker_id WHERE blocked_id = ?");
}

export async function insertBlock(db: D1Database, blockerId: string, blockedId: string, at: number): Promise<void> {
  throw new Error("TODO: INSERT OR IGNORE INTO blocks");
}

export async function insertReport(db: D1Database, r: NewReport): Promise<void> {
  throw new Error("TODO: INSERT INTO reports");
}

// ---------- passport ----------

export async function passportFor(db: D1Database, userId: string): Promise<PassportResT> {
  throw new Error("TODO: stamps (newest first) via stampFromRow, peopleMet = COUNT met_pairs, byLine = COUNT stamps GROUP BY line");
}
