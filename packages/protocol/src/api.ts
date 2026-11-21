// REST request/response shapes. All routes live under /api on the worker.
// Auth: `Authorization: Bearer <token>` except where noted.
// Errors: any non-2xx response has an ErrorRes body.
import { z } from "zod";
import { CarId, Line, MatchInfo, Profile, RideSnapshot, RideState, Stamp, Stop } from "./models";

export const OkRes = z.object({ ok: z.literal(true) });
export type OkRes = z.infer<typeof OkRes>;
export const ErrorRes = z.object({ error: z.string(), code: z.string().optional() });
export type ErrorRes = z.infer<typeof ErrorRes>;

// POST /api/users   (no auth) -> create rider
export const CreateUserReq = Profile;
export type CreateUserReq = z.infer<typeof CreateUserReq>;
export const CreateUserRes = z.object({ userId: z.string(), token: z.string() });
export type CreateUserRes = z.infer<typeof CreateUserRes>;

// GET /api/me
export const MeRes = z.object({ userId: z.string(), profile: Profile, glassesLinked: z.boolean() });
export type MeRes = z.infer<typeof MeRes>;

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
export const TapReq = z.object({
  car: CarId,
  nonce: z.string().optional(),
  destinationStop: z.string().optional(), // stop id; required on first check-in of a ride
});
export type TapReq = z.infer<typeof TapReq>;
export const TapRes = z.discriminatedUnion("result", [
  z.object({ result: z.literal("need-destination"), line: Line, stops: z.array(Stop) }),
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
export const GhostReq = z.object({ ghost: z.boolean() });
export type GhostReq = z.infer<typeof GhostReq>;

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
