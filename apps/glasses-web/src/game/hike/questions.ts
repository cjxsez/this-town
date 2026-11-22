/**
 * questions.ts (glasses-web): the deck for the "Trail trivia" activity.
 *
 * Each question is a photo of a famous hiking place somewhere in the world, a short prompt and four options,
 * one of them right. The order is fixed, so two riders playing on their own glasses see
 * the same questions and can compare.
 *
 * `place` is shown once the answer is revealed and on the recap, so keep it under about
 * 30 characters. Option labels are two or three words: they sit in a 2x2 grid of buttons.
 * Wrong options must be clearly wrong: never another name for the place, never somewhere
 * that is also in the photo.
 *
 * `avoid` is for Split clue (HikeGame with `split`): words the describer may not say.
 * Keep it to three short words that would give the answer away.
 *
 * The photos are 640x400 JPEGs next to this file. Where each one came from, its author and
 * its licence are in CREDITS.md: add a line there with every new photo.
 *
 * A round is ROUND_SIZE questions with SECONDS_PER_QUESTION each. Curated, never generated
 * (same rule as missions).
 */
import everest from "./everest.jpg";
import kilimanjaro from "./kilimanjaro.jpg";
import machuPicchu from "./machu-picchu.jpg";
import torresDelPaine from "./torres-del-paine.jpg";
import trolltunga from "./trolltunga.jpg";

export interface HikeQuestion {
  id: string;
  /** Bundled photo URL. */
  photo: string;
  /** Describes the photo without giving the answer away. */
  alt: string;
  prompt: string;
  options: [string, string, string, string];
  /** Index of the right option. */
  answer: 0 | 1 | 2 | 3;
  place: string;
  /** Split clue only: words the describer may not say. */
  avoid: [string, string, string];
}

/** Index of the picked option, or null when time ran out. */
export type HikeAnswer = number | null;

export const ROUND_SIZE = 5;
export const SECONDS_PER_QUESTION = 20;
/** How long the right answer stays up before the next question. A tap skips ahead. */
export const REVEAL_MS = 2000;

export const QUESTIONS: HikeQuestion[] = [
  {
    id: "everest",
    photo: everest,
    alt: "Huge snow and rock peaks above a glacier, under a dark blue sky",
    prompt: "Which mountain range is this?",
    options: ["Andes", "Alps", "Himalayas", "Rockies"],
    answer: 2,
    place: "Mount Everest, Nepal side",
    avoid: ["Everest", "Nepal", "highest"],
  },
  {
    id: "torres",
    photo: torresDelPaine,
    alt: "Three granite towers above a pale green glacial lake",
    prompt: "Where are these towers?",
    options: ["Torres del Paine", "Fitz Roy", "Tre Cime", "Half Dome"],
    answer: 0,
    place: "Torres del Paine, Chile",
    avoid: ["towers", "Chile", "Patagonia"],
  },
  {
    id: "machu-picchu",
    photo: machuPicchu,
    alt: "Stone ruins and terraces on a ridge below a steep peak in the mist",
    prompt: "Which trail ends here?",
    options: ["Milford Track", "Inca Trail", "Annapurna Circuit", "Camino de Santiago"],
    answer: 1,
    place: "Machu Picchu, Peru",
    avoid: ["Inca", "Peru", "ruins"],
  },
  {
    id: "trolltunga",
    photo: trolltunga,
    alt: "A flat tongue of rock sticking out high above a long dark lake",
    prompt: "Which country is this?",
    options: ["Iceland", "New Zealand", "Canada", "Norway"],
    answer: 3,
    place: "Trolltunga, Norway",
    avoid: ["tongue", "troll", "fjord"],
  },
  {
    id: "kilimanjaro",
    photo: kilimanjaro,
    alt: "A broad snow-capped mountain rising over a plain with flat-topped trees",
    prompt: "Which mountain is this?",
    options: ["Mount Kenya", "Aconcagua", "Kilimanjaro", "Mount Fuji"],
    answer: 2,
    place: "Kilimanjaro, Tanzania",
    avoid: ["Africa", "Tanzania", "safari"],
  },
];
