/**
 * lib/api.ts: TypeScript aliases for protocol REST shapes.
 *
 * Responsible for:
 * - `z.infer` aliases for the response schemas in packages/protocol/src/api.ts (the protocol
 *   exports schemas but not inferred types for REST bodies).
 * - Match payload helpers derived from ServerToRider.
 *
 * Protocol types: CreateUserRes, MeRes, GlassesCodeRes, GlassesCodePollRes, GlassesLinkRes,
 * TapRes, PassportRes, RideStateRes, OkRes, ServerToRider (match.found), Mission, RideState.
 */
import type { z } from "zod";
import type {
  AuthVerifyRes,
  CreateUserRes,
  GlassesCodePollRes,
  GlassesCodeRes,
  GlassesLinkRes,
  MeRes,
  OkRes,
  PassportRes,
  RideStateRes,
  ServerToRider,
  TapRes,
} from "@questline/protocol";

export type CreateUserResT = z.infer<typeof CreateUserRes>;
export type MeResT = z.infer<typeof MeRes>;
export type AuthVerifyResT = z.infer<typeof AuthVerifyRes>;
export type GlassesCodeResT = z.infer<typeof GlassesCodeRes>;
export type GlassesCodePollResT = z.infer<typeof GlassesCodePollRes>;
export type GlassesLinkResT = z.infer<typeof GlassesLinkRes>;
export type TapResT = z.infer<typeof TapRes>;
export type PassportResT = z.infer<typeof PassportRes>;
export type RideStateResT = z.infer<typeof RideStateRes>;
export type OkResT = z.infer<typeof OkRes>;

export type MatchFoundT = Extract<ServerToRider, { type: "match.found" }>;
export type MatchClearedT = Extract<ServerToRider, { type: "match.cleared" }>;
/** match.found without the `type` tag, for snapshots. */
export type MatchPayload = Omit<MatchFoundT, "type">;
