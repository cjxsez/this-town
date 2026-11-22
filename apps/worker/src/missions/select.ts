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

function weightedPick(items: readonly MissionTemplate[], random: () => number): MissionTemplate | null {
  const total = items.reduce((sum, t) => sum + effectiveWeight(t), 0);
  if (total <= 0) return items[0] ?? null;
  let r = random() * total;
  for (const t of items) {
    r -= effectiveWeight(t);
    if (r <= 0) return t;
  }
  return items[items.length - 1] ?? null;
}

/**
 * When the late-train bonus is unlocked, a fitting late-bonus mission wins. Otherwise pick
 * from the regular categories. Templates either rider did recently are avoided, but if that
 * leaves nothing, one of those is allowed. A template this pair already did is never given
 * again (architecture.md "Missions"): with nothing left the pair waits for the next segment.
 */
export function selectMission(input: SelectInput): MissionTemplate | null {
  const deck = input.deck ?? DECK;
  const random = input.random ?? Math.random;
  const fitting = deck.filter((t) => fitsBefore(t, input.availableSec) && !input.pairHistory.includes(t.id));
  const fresh = (ts: MissionTemplate[]) => ts.filter((t) => !isRepeat(t, input));
  const pick = (ts: MissionTemplate[]) => (ts.length === 0 ? null : weightedPick(fresh(ts).length > 0 ? fresh(ts) : ts, random));

  if (input.lateBonusUnlocked) {
    const bonus = fitting.filter((t) => t.category === "late-bonus");
    if (bonus.length > 0) return pick(bonus);
  }
  const regular = fitting.filter((t) => t.category !== "late-bonus");
  return regular.length > 0 ? pick(regular) : null;
}
