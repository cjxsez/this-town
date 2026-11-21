/**
 * missions/select.ts: choose which template a pair plays.
 *
 * Responsible for (architecture.md "Missions"):
 * - Fit: a template is only eligible if minSeconds <= time until (next stop minus 30 s).
 *   If nothing fits, return null and TrainRoom waits for the next segment.
 * - Late-train bonus: when the trip delay exceeds LATE_BONUS_MIN_DELAY_S, late-bonus
 *   templates unlock and are preferred. Otherwise late-bonus is never picked.
 * - Anti-repeat: skip any template either rider did in their last 10, and never the same
 *   template twice for this pair (ever).
 * - Rarity: rare templates (outside late-bonus) are picked with weight * RARE_WEIGHT_FACTOR.
 *
 * Protocol types: MissionCategory (via MissionTemplate), Mission.rare.
 *
 * TODO:
 * - selectMission(): filter (fits, unlocked, not repeated), prefer late-bonus when unlocked,
 *   then weighted random pick with input.random ?? Math.random.
 * - If anti-repeat empties the eligible set, relax the per-user rule (keep the per-pair rule).
 */
import { DECK, type MissionTemplate } from "./deck";

export const RARE_WEIGHT_FACTOR = 0.15;

export interface SelectInput {
  deck?: readonly MissionTemplate[];
  /** Seconds until (nextStopEta - 30 s). */
  availableSec: number;
  lateBonusUnlocked: boolean;
  /** Each rider's last 10 template ids. */
  userHistories: readonly (readonly string[])[];
  /** Every template id this pair has done. */
  pairHistory: readonly string[];
  random?: () => number;
}

export function fitsBefore(t: MissionTemplate, availableSec: number): boolean {
  return t.minSeconds <= availableSec;
}

export function isRepeat(t: MissionTemplate, input: SelectInput): boolean {
  return input.pairHistory.includes(t.id) || input.userHistories.some((h) => h.includes(t.id));
}

export function effectiveWeight(t: MissionTemplate): number {
  return t.rare && t.category !== "late-bonus" ? t.weight * RARE_WEIGHT_FACTOR : t.weight;
}

export function selectMission(input: SelectInput): MissionTemplate | null {
  const deck = input.deck ?? DECK;
  throw new Error("TODO: filter deck by fitsBefore / late-bonus unlock / isRepeat, weighted pick");
}
