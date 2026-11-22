/**
 * games/trivia-deck.ts: the starter questions for "Left for you". They fill the game when
 * earlier pairs have not left three questions yet. Curated by hand: only facts that are
 * certain, each with one right answer and three wrong ones.
 */

/** A finished question: what a pair left (after the wrong answers were written) or a starter. */
export interface TriviaCard {
  q: string;
  /** The right answer. */
  a: string;
  /** Three wrong answers. */
  decoys: string[];
}

/** The longest "who left it" line kept with a question, e.g. "Maya and Sam". */
export const TRIVIA_MAX_BY = 40;

export const TRIVIA_STARTERS: TriviaCard[] = [
  { q: "America's first subway opened in Boston in what year?", a: "1897", decoys: ["1863", "1904", "1921"] },
  {
    q: "The CharlieCard is named after a character in which song?",
    a: "M.T.A.",
    decoys: ["Sweet Caroline", "Dirty Water", "Shipping Up to Boston"],
  },
  { q: "What year did Fenway Park open?", a: "1912", decoys: ["1903", "1908", "1925"] },
  {
    q: "Which line still runs historic PCC trolleys?",
    a: "Mattapan Line",
    decoys: ["Blue Line", "Silver Line", "Orange Line"],
  },
];
