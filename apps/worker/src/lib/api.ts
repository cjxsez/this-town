/**
 * lib/api.ts: TypeScript aliases for protocol REST shapes, plus the few response shapes
 * the protocol does not define yet.
 *
 * Responsible for:
 * - `z.infer` aliases for the response schemas in packages/protocol/src/api.ts (the protocol
 *   exports schemas but not inferred types for REST bodies).
 * - Worker-local shapes that are not in the protocol yet:
 *   - `RidePollRes` for GET /api/ride/state (glasses polling fallback). RideState alone has
 *     no partner or mission, so the glasses could not render a match card from it.
 *   - `OkRes` for POST /api/ride/end, POST /api/report.
 *   These should move into packages/protocol (see apps/worker/README.md, "Protocol gaps").
 *
 * Protocol types: CreateUserRes, MeRes, GlassesCodeRes, GlassesCodePollRes, GlassesLinkRes,
 * TapRes, PassportRes, ServerToRider (match.found), Mission, RideState.
 *
 * TODO:
 * - Move RidePollRes / OkRes into packages/protocol and delete them here.
 */
import type { z } from "zod";
import type {
  CreateUserRes,
  GlassesCodePollRes,
  GlassesCodeRes,
  GlassesLinkRes,
  MeRes,
  Mission,
  PassportRes,
  RideState,
  ServerToRider,
  TapRes,
} from "@questline/protocol";

export type CreateUserResT = z.infer<typeof CreateUserRes>;
export type MeResT = z.infer<typeof MeRes>;
export type GlassesCodeResT = z.infer<typeof GlassesCodeRes>;
export type GlassesCodePollResT = z.infer<typeof GlassesCodePollRes>;
export type GlassesLinkResT = z.infer<typeof GlassesLinkRes>;
export type TapResT = z.infer<typeof TapRes>;
export type PassportResT = z.infer<typeof PassportRes>;

export type MatchFoundT = Extract<ServerToRider, { type: "match.found" }>;
export type MatchClearedT = Extract<ServerToRider, { type: "match.cleared" }>;
/** match.found without the `type` tag, for snapshots. */
export type MatchPayload = Omit<MatchFoundT, "type">;

/** GET /api/ride/state. Everything the glasses need to render without a socket. */
export interface RidePollRes {
  state: RideState;
  match: MatchPayload | null;
  mission: Mission | null;
}

export interface OkRes {
  ok: true;
}
