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
  { q: "How many branches does the Green Line have?", a: "Four", decoys: ["Two", "Three", "Five"] },
  { q: "In what year did Boston's first subway open?", a: "1897", decoys: ["1863", "1904", "1921"] },
  {
    q: "The CharlieCard is named after a character in which song?",
    a: "M.T.A.",
    decoys: ["Sweet Caroline", "Dirty Water", "Shipping Up to Boston"],
  },
  {
    q: "The Red Line splits in the south. One branch ends at Ashmont. Where does the other end?",
    a: "Braintree",
    decoys: ["Alewife", "Forest Hills", "Wonderland"],
  },
  { q: "Which line runs to Wonderland?", a: "Blue Line", decoys: ["Red Line", "Orange Line", "Green Line"] },
  { q: "The Orange Line runs from Oak Grove to where?", a: "Forest Hills", decoys: ["Braintree", "Ashmont", "Riverside"] },
  { q: "What year did Fenway Park open?", a: "1912", decoys: ["1903", "1908", "1925"] },
  { q: "Which T line is made up of buses, not trains?", a: "Silver Line", decoys: ["Blue Line", "Orange Line", "Red Line"] },
  {
    q: "Which line still runs historic PCC trolleys?",
    a: "Mattapan Line",
    decoys: ["Blue Line", "Silver Line", "Orange Line"],
  },
  {
    q: "At which station do the Red and Green lines cross?",
    a: "Park Street",
    decoys: ["Downtown Crossing", "State", "Government Center"],
  },
];
