/**
 * questions.ts (glasses-web): the deck for the "Guess who" activity.
 *
 * Two kinds, both answered about the person standing in front of the wearer:
 *   either  "Is this person a night owl or a day person?"  two options, trivia style
 *   scale   "How much does this person like horror movies?" 0 to 10
 *
 * `short` names a scale question on the recap screen.
 *
 * A round is ROUND_SIZE questions with SECONDS_PER_QUESTION each. Curated, never generated
 * (same rule as missions). Keep prompts short: two lines at .hud-body size on a 600px lens.
 */
export type Question =
  | { kind: "either"; id: string; prompt: string; options: [string, string] }
  | { kind: "scale"; id: string; prompt: string; short: string; low: string; high: string };

export type Answer = string | number | null; // null = time ran out

export const ROUND_SIZE = 5;
export const SECONDS_PER_QUESTION = 20;

export const QUESTIONS: Question[] = [
  { kind: "either", id: "owl", prompt: "Is this person a…", options: ["Night owl", "Day person"] },
  { kind: "scale", id: "horror", prompt: "How much does this person like horror movies?", short: "Horror movies", low: "Nope", high: "Loves them" },
  { kind: "either", id: "plan", prompt: "On a free Saturday, this person…", options: ["Has a plan", "Wings it"] },
  { kind: "scale", id: "spice", prompt: "How spicy does this person order their food?", short: "Spice level", low: "Mild", high: "Max heat" },
  { kind: "either", id: "pet", prompt: "Is this person a…", options: ["Dog person", "Cat person"] },
];
