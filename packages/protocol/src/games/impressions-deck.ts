/**
 * games/impressions-deck.ts: the question deck for "First impressions". Every question is
 * about the other player and is answered on a slider, or by picking one of two (`either`).
 * `boston` marks the Boston / T ones; each game draws at least one of those.
 *
 * A slider question asks "how much" or "how many". A yes/no or either/or question does not
 * belong on a slider.
 *
 * Keep them friendly: nothing about age, weight, money, looks, politics, religion or dating.
 * Keep each slider to about eleven positions, since the glasses move one position per swipe.
 */

export interface ImpressionsQuestion {
  id: string;
  /** The full question, about "your partner". */
  prompt: string;
  /** A few words for the compare and recap screens. */
  short: string;
  min: number;
  max: number;
  step: number;
  /** Labels for the two ends of the slider. */
  low: string;
  high: string;
  /** Shown after the number, e.g. "years". Empty for the 0 to 10 feelings scales. */
  unit: string;
  /** The top value means "this or more" and is shown with a plus. */
  plus: boolean;
  boston: boolean;
  /** One or the other, not a scale: min is `low`, max is `high`, and there is nothing between. */
  either?: boolean;
}

function feel(id: string, prompt: string, short: string, low: string, high: string, boston = false): ImpressionsQuestion {
  return { id, prompt, short, min: 0, max: 10, step: 1, low, high, unit: "", plus: false, boston };
}

function count(
  id: string,
  prompt: string,
  short: string,
  max: number,
  step: number,
  unit: string,
  low: string,
  high: string,
  boston = false,
  plus = true,
): ImpressionsQuestion {
  return { id, prompt, short, min: 0, max, step, low, high, unit, plus, boston };
}

function either(id: string, prompt: string, short: string, low: string, high: string): ImpressionsQuestion {
  return { id, prompt, short, min: 0, max: 1, step: 1, low, high, unit: "", plus: false, boston: false, either: true };
}

export const IMPRESSIONS_DECK: ImpressionsQuestion[] = [
  // Boston and the T
  count("dunkin", "How many Dunkin' orders does your partner make in a week?", "Dunkin' a week", 10, 1, "orders", "None", "Runs on it", true),
  feel("red-sox", "How big a Red Sox fan is your partner?", "Red Sox fan", "Not at all", "Die-hard", true),
  feel("green-line", "How calm is your partner when the Green Line crawls?", "Calm on a slow train", "Fuming", "Total zen", true),
  // Anywhere
  feel("spicy", "How spicy does your partner like their food?", "Likes spicy food", "Mild", "On fire"),
  feel("texts", "How fast does your partner text back?", "Texts back fast", "Days later", "Instantly"),
  feel("pineapple", "How does your partner feel about pineapple on pizza?", "Pineapple on pizza", "No way", "Yes please"),
  either("cats-dogs", "Is your partner a cat person or a dog person?", "Cats or dogs", "Cats", "Dogs"),
];

/** The guess as shown to players, without the unit: "12", "20+" at the top of an open scale, or "Cats". */
export function impressionsValue(q: ImpressionsQuestion, value: number): string {
  if (q.either) return value >= q.max ? q.high : q.low;
  return q.plus && value >= q.max ? `${value}+` : String(value);
}

/** What goes after the number: the unit, or "out of 10" on a feelings scale. Nothing for an either/or. */
export function impressionsUnit(q: ImpressionsQuestion): string {
  if (q.either) return "";
  return q.unit || `out of ${q.max}`;
}

/** Where the slider starts: the middle, on a step. */
export function impressionsStart(q: ImpressionsQuestion): number {
  return impressionsSnap(q, (q.min + q.max) / 2);
}

/** The nearest allowed slider value. */
export function impressionsSnap(q: ImpressionsQuestion, value: number): number {
  const steps = Math.round((value - q.min) / q.step);
  return Math.min(q.max, Math.max(q.min, q.min + steps * q.step));
}
