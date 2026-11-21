// REST request/response shapes. All routes live under /api on the worker.
// Auth: `Authorization: Bearer <token>` except where noted.
import { z } from "zod";
import { CarId, Profile, RideState, Stamp } from "./models";

// POST /api/users   (no auth) -> create rider
export const CreateUserReq = Profile;
export const CreateUserRes = z.object({ userId: z.string(), token: z.string() });

// GET /api/me
export const MeRes = z.object({ userId: z.string(), profile: Profile, glassesLinked: z.boolean() });

// POST /api/glasses/code   (no auth, called by glasses-web) -> show this code on the lens
export const GlassesCodeRes = z.object({ code: z.string().regex(/^\d{4}$/), expiresAt: z.number().int() });
// GET /api/glasses/code/:code   (no auth, glasses poll until linked)
export const GlassesCodePollRes = z.object({ linked: z.boolean(), token: z.string().optional() });
// POST /api/glasses/link   (rider auth, called by phone-web with the code they see)
export const GlassesLinkReq = z.object({ code: z.string().regex(/^\d{4}$/) });
export const GlassesLinkRes = z.object({ ok: z.literal(true) });

// POST /api/taps   (rider auth) -> phone-web calls this from the NFC landing page /k/:car?n=
// The worker decides: check-in, move car, or stamp confirm.
export const TapReq = z.object({
  car: CarId,
  nonce: z.string().optional(),
  destinationStop: z.string().optional(), // required on first check-in of a ride
});
export const TapRes = z.discriminatedUnion("result", [
  z.object({ result: z.literal("need-destination"), line: z.string(), stops: z.array(z.string()) }),
  z.object({ result: z.literal("checked-in"), state: RideState }),
  z.object({ result: z.literal("moved-car"), state: RideState }),
  z.object({ result: z.literal("stamp-pending") }),      // you tapped, waiting on partner
  z.object({ result: z.literal("stamp-awarded"), stamp: Stamp }),
  z.object({ result: z.literal("error"), message: z.string() }),
]);

// POST /api/ride/end    -> check out, Ride Mode off
// PUT  /api/ride/ghost  { ghost: boolean }
export const GhostReq = z.object({ ghost: z.boolean() });

// GET /api/passport
export const PassportRes = z.object({
  stamps: z.array(Stamp),
  peopleMet: z.number().int(),
  byLine: z.record(z.string(), z.number().int()),
});

// POST /api/report   { reportedMatchId, reason }
export const ReportReq = z.object({ matchId: z.string(), reason: z.string().max(280), block: z.boolean() });
