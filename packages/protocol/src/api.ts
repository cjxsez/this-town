// REST request/response shapes. All routes live under /api on the worker.
// Auth: `Authorization: Bearer <token>` except where noted.
// Errors: any non-2xx response has an ErrorRes body.
import { z } from "zod";
import { CarId, Line, MatchInfo, PairColor, Profile, RideSnapshot, RideState, SocialBattery, Stamp, Stop } from "./models";

export const OkRes = z.object({ ok: z.literal(true) });
export type OkRes = z.infer<typeof OkRes>;
export const ErrorRes = z.object({ error: z.string(), code: z.string().optional() });
export type ErrorRes = z.infer<typeof ErrorRes>;

// ---- Email sign-in (one-time code) ----
// An email address is an account. Signing in sends a 6-digit code; verifying it either
// signs in to the existing rider or, for a new email, returns a short-lived signupTicket
// that POST /api/users redeems so the new rider is created with that email.
// "Just play today" skips this: POST /api/users without a ticket makes an email-less guest.
export const Email = z.string().trim().toLowerCase().email().max(254);
export type Email = z.infer<typeof Email>;

// POST /api/auth/email/start   (no auth) -> OkRes. Sends the code.
//   429 ErrorRes code "too-soon" when a code was sent to this email in the last 30 s,
//   or "rate-limited" past the per-IP / per-email caps (any no-auth route can answer that).
export const AuthStartReq = z.object({ email: Email });
export type AuthStartReq = z.infer<typeof AuthStartReq>;

// POST /api/auth/email/verify  (no auth) -> AuthVerifyRes
//   400 ErrorRes code "wrong-code" | "expired" (no live code: ask for a new one) | "too-many-attempts"
export const AuthVerifyReq = z.object({ email: Email, code: z.string().regex(/^\d{6}$/) });
export type AuthVerifyReq = z.infer<typeof AuthVerifyReq>;
export const AuthVerifyRes = z.discriminatedUnion("status", [
  // Existing account: a new phone session for it.
  z.object({ status: z.literal("signed-in"), userId: z.string(), token: z.string(), email: Email, profile: Profile }),
  // No account for this email yet: onboard, then POST /api/users with the ticket (valid 30 min).
  z.object({ status: z.literal("new-account"), email: Email, signupTicket: z.string() }),
]);
export type AuthVerifyRes = z.infer<typeof AuthVerifyRes>;

// POST /api/users   (no auth) -> create rider
//   With signupTicket: the rider gets the verified email (an account). Without: a guest.
//   400 ErrorRes code "bad-ticket" (expired or used), 409 code "email-taken".
export const CreateUserReq = Profile.extend({ signupTicket: z.string().optional() });
export type CreateUserReq = z.infer<typeof CreateUserReq>;
export const CreateUserRes = z.object({ userId: z.string(), token: z.string() });
export type CreateUserRes = z.infer<typeof CreateUserRes>;

// GET /api/me
export const MeRes = z.object({
  userId: z.string(),
  profile: Profile,
  glassesLinked: z.boolean(),
  email: Email.nullable(), // null for "Just play today" guests
});
export type MeRes = z.infer<typeof MeRes>;
// PATCH /api/me   -> MeRes. Edit any profile field; the train you're on sees it right away.
export const UpdateProfileReq = Profile.omit({ is18Plus: true }).partial();
export type UpdateProfileReq = z.infer<typeof UpdateProfileReq>;
// DELETE /api/me  -> OkRes. Ends the ride, signs out every device, scrubs the profile.

// POST /api/glasses/code   (no auth, called by glasses-web) -> show `code` on the lens, keep `pollSecret`
export const GlassesCodeRes = z.object({
  code: z.string().regex(/^\d{4}$/),
  pollSecret: z.string(), // required to poll, so guessing the 4-digit code alone doesn't leak a token
  expiresAt: z.number().int(),
});
export type GlassesCodeRes = z.infer<typeof GlassesCodeRes>;
// GET /api/glasses/code/:code?secret=   (no auth, glasses poll until linked). 410 = expired, request a new code.
export const GlassesCodePollRes = z.object({ linked: z.boolean(), token: z.string().optional() });
export type GlassesCodePollRes = z.infer<typeof GlassesCodePollRes>;
// POST /api/glasses/link   (rider auth, called by phone-web with the code they see) -> OkRes
export const GlassesLinkReq = z.object({ code: z.string().regex(/^\d{4}$/) });
export type GlassesLinkReq = z.infer<typeof GlassesLinkReq>;
export const GlassesLinkRes = OkRes;
export type GlassesLinkRes = OkRes;

// POST /api/taps   (rider auth) -> phone-web calls this from the NFC landing page /k/:car?n=
// The worker decides: check-in, move car, or stamp. The tap itself is the stamp confirmation.
// Turning on Ride Mode is the consent to be matched (no accept step later), so the first
// check-in of a ride needs both a destination and rideMode: true, which the phone only sends
// after the rider confirmed on the Ride Mode screen. Without them: need-destination.
export const TapReq = z.object({
  car: CarId,
  nonce: z.string().optional(),
  destinationStop: z.string().optional(), // stop id; required on first check-in of a ride
  rideMode: z.literal(true).optional(),    // required on first check-in of a ride
});
export type TapReq = z.infer<typeof TapReq>;
export const TapRes = z.discriminatedUnion("result", [
  z.object({
    result: z.literal("need-destination"),
    line: Line,
    car: CarId,
    stops: z.array(Stop),
    suggestedStop: z.string().nullable(), // last destination on this line, preselected
  }),
  z.object({ result: z.literal("checked-in"), state: RideState }),
  z.object({ result: z.literal("moved-car"), state: RideState }),
  z.object({ result: z.literal("stamp-pending") }), // you tapped, waiting on partner
  z.object({ result: z.literal("stamp-awarded"), stamp: Stamp }),
  z.object({ result: z.literal("error"), message: z.string() }),
]);
export type TapRes = z.infer<typeof TapRes>;

// GET  /api/ride/state     -> RideSnapshot (polling fallback for glasses, and reload recovery)
export const RideStateRes = RideSnapshot;
export type RideStateRes = z.infer<typeof RideStateRes>;
// POST /api/ride/end       -> OkRes   (check out, Ride Mode off)
// POST /api/ride/not-now   -> OkRes   (REST twin of rider.notNow)
// POST /api/ride/arrived   -> OkRes   (REST twin of rider.arrived)
// PUT  /api/ride/ghost     { ghost } -> OkRes
// POST /api/ride/mood      { mood } -> OkRes   (social battery for the rest of this ride and after)
export const GhostReq = z.object({ ghost: z.boolean() });
export type GhostReq = z.infer<typeof GhostReq>;
export const MoodReq = z.object({ mood: SocialBattery });
export type MoodReq = z.infer<typeof MoodReq>;

// GET /api/passport
export const PassportRes = z.object({
  stamps: z.array(Stamp),
  peopleMet: z.number().int(),
  byLine: z.record(z.string(), z.number().int()), // keys are Line values
});
export type PassportRes = z.infer<typeof PassportRes>;

// GET /api/matches/recent   -> last few matches, so you can report someone after the match ended
export const RecentMatchesRes = z.object({
  matches: z.array(
    z.object({
      matchId: z.string(),
      partnerFirstName: z.string(),
      color: PairColor,
      line: Line,
      at: z.number().int(),
      stamped: z.boolean(),
    }),
  ),
});
export type RecentMatchesRes = z.infer<typeof RecentMatchesRes>;

// POST /api/report   { matchId, reason, block } -> OkRes
export const ReportReq = z.object({ matchId: z.string(), reason: z.string().max(280), block: z.boolean() });
export type ReportReq = z.infer<typeof ReportReq>;

// Re-exported for convenience.
export type { MatchInfo };
