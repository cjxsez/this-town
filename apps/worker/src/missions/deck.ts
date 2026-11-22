/**
 * missions/deck.ts: the curated mission deck. No LLM-generated missions (CLAUDE.md rules,
 * decision D1).
 *
 * Responsible for:
 * - Every mission template, by category: create, show-me, spot, quick-game, late-bonus.
 * - Per template: how long it needs (`minSeconds`, must fit before next stop minus 30 s),
 *   whether it is rare, and a selection weight.
 *
 * Slots (filled by fill.ts):
 *   {station}      next stop, e.g. "Downtown Crossing"
 *   {lastStation}  stop just passed
 *   {line}         line name, e.g. "Orange"
 *   {terminus}     last stop of this trip
 *   {color}        the pair's color name
 *
 * The prompt is shown on the PUBLIC kiosk screen (MissionShowEvent), so templates must never
 * reference interests, "ask me about", blurbs or anything personal. First names and colors
 * only. Keep missions safe for strangers: no touching, no photos, no going anywhere, nothing
 * that singles out other passengers.
 *
 * Protocol types: MissionCategory (and Mission, which fill.ts produces from a template).
 */
import type { MissionCategory } from "@questline/protocol";

export const SLOT_NAMES = ["station", "lastStation", "line", "terminus", "color"] as const;
export type SlotName = (typeof SLOT_NAMES)[number];

export interface MissionTemplate {
  id: string;
  category: MissionCategory;
  title: string;
  prompt: string;
  /** Minimum seconds needed. Must be <= (nextStopEta - 30 s - now). */
  minSeconds: number;
  rare: boolean;
  /** Relative pick weight before the rarity factor. */
  weight: number;
}

export const DECK: readonly MissionTemplate[] = [
  // ---------- create ----------
  {
    id: "create-rename-station",
    category: "create",
    title: "Rename the station",
    prompt: "Rename {station}. Best name wins.",
    minSeconds: 60,
    rare: false,
    weight: 3,
  },
  {
    id: "create-line-slogan",
    category: "create",
    title: "Line slogan",
    prompt: "Write a five-word slogan for the {line} Line. Say it out loud together.",
    minSeconds: 60,
    rare: false,
    weight: 2,
  },
  {
    id: "create-station-mascot",
    category: "create",
    title: "Station mascot",
    prompt: "Invent a mascot for {station}. Give it a name and a catchphrase.",
    minSeconds: 75,
    rare: false,
    weight: 2,
  },
  {
    id: "create-one-word-story",
    category: "create",
    title: "One-word story",
    prompt: "Tell a story one word at a time, taking turns, until the doors open at {station}.",
    minSeconds: 90,
    rare: false,
    weight: 1,
  },

  // ---------- show-me ----------
  {
    id: "show-me-announcer",
    category: "show-me",
    title: "Be the announcer",
    prompt: "Show me your best train announcer voice: \"Next stop, {station}.\" Partner rates it 1 to 10.",
    minSeconds: 45,
    rare: false,
    weight: 3,
  },
  {
    id: "show-me-emoji",
    category: "show-me",
    title: "Most-used emoji",
    prompt: "Show me your most-used emoji and tell the story behind it.",
    minSeconds: 60,
    rare: false,
    weight: 2,
  },
  {
    id: "show-me-directions",
    category: "show-me",
    title: "Tour guide",
    prompt: "Show me how you'd send a tourist from {station} to the best thing within a ten-minute walk.",
    minSeconds: 75,
    rare: false,
    weight: 2,
  },
  {
    id: "show-me-secret-shortcut",
    category: "show-me",
    title: "Secret shortcut",
    prompt: "Show me a shortcut or trick on the {line} Line that only regulars know.",
    minSeconds: 60,
    rare: true,
    weight: 1,
  },

  // ---------- spot ----------
  {
    id: "spot-your-color",
    category: "spot",
    title: "Spot your color",
    prompt: "Spot something {color} in this car. First to point it out wins.",
    minSeconds: 30,
    rare: false,
    weight: 3,
  },
  {
    id: "spot-better-ad",
    category: "spot",
    title: "Fix an ad",
    prompt: "Spot an ad in this car and pitch it a better tagline.",
    minSeconds: 60,
    rare: false,
    weight: 2,
  },
  {
    id: "spot-car-number",
    category: "spot",
    title: "Car number",
    prompt: "Guess this car's number, then find it printed inside the car. Closest guess wins.",
    minSeconds: 45,
    rare: false,
    weight: 2,
  },
  {
    id: "spot-station-sign",
    category: "spot",
    title: "Sign spotter",
    prompt: "Be the first to spot the {station} sign as the train pulls in. Call it out.",
    minSeconds: 30,
    rare: false,
    weight: 1,
  },

  // ---------- quick-game ----------
  {
    id: "quick-game-rps",
    category: "quick-game",
    title: "Rock paper scissors",
    prompt: "Rock paper scissors, best of five. Loser names their favorite stop on the {line} Line.",
    minSeconds: 45,
    rare: false,
    weight: 3,
  },
  {
    id: "quick-game-two-truths",
    category: "quick-game",
    title: "Two truths and a lie",
    prompt: "Two truths and a lie. One round each, guess before {station}.",
    minSeconds: 90,
    rare: false,
    weight: 2,
  },
  {
    id: "quick-game-would-you-rather",
    category: "quick-game",
    title: "Would you rather",
    prompt: "Would you rather live right at {station} or at the end of the line in {terminus}? Defend it.",
    minSeconds: 60,
    rare: false,
    weight: 2,
  },
  {
    id: "quick-game-count-to-20",
    category: "quick-game",
    title: "Don't say 20",
    prompt: "Count to 20 together, one or two numbers per turn. Whoever has to say 20 loses.",
    minSeconds: 30,
    rare: false,
    weight: 2,
  },

  // ---------- late-bonus (only when MBTA delay > LATE_BONUS_MIN_DELAY_S) ----------
  {
    id: "late-bonus-official-excuse",
    category: "late-bonus",
    title: "Official excuse",
    prompt: "The train is running late. Write the official announcement explaining why. Make it believable.",
    minSeconds: 60,
    rare: true,
    weight: 3,
  },
  {
    id: "late-bonus-perfect-ten",
    category: "late-bonus",
    title: "Bonus ten minutes",
    prompt: "You just got ten bonus minutes at {station}. Plan them together, minute by minute.",
    minSeconds: 75,
    rare: true,
    weight: 2,
  },
  {
    id: "late-bonus-teach-a-word",
    category: "late-bonus",
    title: "Teach me a word",
    prompt: "Delay bonus: teach each other one word in a language the other doesn't speak.",
    minSeconds: 60,
    rare: true,
    weight: 2,
  },
  {
    id: "late-bonus-station-count",
    category: "late-bonus",
    title: "Line trivia",
    prompt: "How many stations does the {line} Line have, end to end? Closest guess wins. Check the map by {station}.",
    minSeconds: 45,
    rare: true,
    weight: 1,
  },

  // ---------- more of each, so anti-repeat never runs dry (a pair never repeats one) ----------
  {
    id: "create-new-stop",
    category: "create",
    title: "A new stop",
    prompt: "Invent a stop between {lastStation} and {station}. Name it and say what's there.",
    minSeconds: 60,
    rare: false,
    weight: 3,
  },
  {
    id: "create-line-anthem",
    category: "create",
    title: "Line anthem",
    prompt: "Make up the first two lines of the {line} Line's anthem. Hum the tune if you dare.",
    minSeconds: 75,
    rare: false,
    weight: 2,
  },
  {
    id: "create-car-rules",
    category: "create",
    title: "House rules",
    prompt: "Write three house rules for this car. One of them has to be silly.",
    minSeconds: 60,
    rare: false,
    weight: 2,
  },
  {
    id: "create-station-menu",
    category: "create",
    title: "Station special",
    prompt: "{station} opens a food stand. Invent its one signature dish and price it.",
    minSeconds: 60,
    rare: false,
    weight: 2,
  },
  {
    id: "create-terminus-postcard",
    category: "create",
    title: "Postcard home",
    prompt: "Write a one-line postcard from {terminus} as if it were a faraway vacation spot.",
    minSeconds: 45,
    rare: true,
    weight: 2,
  },
  {
    id: "show-me-pocket",
    category: "show-me",
    title: "Pocket check",
    prompt: "Show me the most interesting thing in your bag or pocket right now. Partner guesses why you carry it.",
    minSeconds: 45,
    rare: false,
    weight: 3,
  },
  {
    id: "show-me-order",
    category: "show-me",
    title: "Usual order",
    prompt: "Show me how you order your usual coffee or snack, word for word. Partner orders it back.",
    minSeconds: 45,
    rare: false,
    weight: 2,
  },
  {
    id: "show-me-walk",
    category: "show-me",
    title: "Signature move",
    prompt: "Show me how you'd celebrate catching a train just as the doors close. Smallest version allowed.",
    minSeconds: 30,
    rare: false,
    weight: 2,
  },
  {
    id: "show-me-boston-word",
    category: "show-me",
    title: "Say it like a local",
    prompt: "Show me how a local says a Boston name, like Worcester or Peabody. Partner tries it.",
    minSeconds: 45,
    rare: false,
    weight: 2,
  },
  {
    id: "show-me-playlist",
    category: "show-me",
    title: "Ride soundtrack",
    prompt: "Show me the song you'd put on for this exact ride, and hum ten seconds of it.",
    minSeconds: 60,
    rare: true,
    weight: 2,
  },
  {
    id: "spot-most-boston",
    category: "spot",
    title: "Most Boston thing",
    prompt: "Spot the most Boston thing in this car: a sign, an ad, a seat, never a person. Both point at once, then argue.",
    minSeconds: 30,
    rare: false,
    weight: 3,
  },
  {
    id: "spot-map-route",
    category: "spot",
    title: "Map route",
    prompt: "Find {station} on the map in this car and trace the fastest way from it to {terminus}.",
    minSeconds: 60,
    rare: false,
    weight: 2,
  },
  {
    id: "spot-count-colors",
    category: "spot",
    title: "Color count",
    prompt: "Count everything {color} you can see from where you stand. Higher count wins.",
    minSeconds: 45,
    rare: false,
    weight: 2,
  },
  {
    id: "spot-oldest-thing",
    category: "spot",
    title: "Oldest thing here",
    prompt: "Spot the oldest-looking part of this car: a sign, a handle, a sticker. Make up the year it arrived.",
    minSeconds: 45,
    rare: false,
    weight: 2,
  },
  {
    id: "spot-window-view",
    category: "spot",
    title: "Window view",
    prompt: "When the train surfaces or slows, spot one thing outside and name it like a museum piece.",
    minSeconds: 60,
    rare: true,
    weight: 2,
  },
  {
    id: "quick-game-categories",
    category: "quick-game",
    title: "Categories",
    prompt: "Name T stations in turns. First one stuck for five seconds loses.",
    minSeconds: 45,
    rare: false,
    weight: 3,
  },
  {
    id: "quick-game-higher-lower",
    category: "quick-game",
    title: "Higher or lower",
    prompt: "One thinks of a number from 1 to 100, the other guesses with higher or lower. Swap. Fewest guesses wins.",
    minSeconds: 60,
    rare: false,
    weight: 2,
  },
  {
    id: "quick-game-word-chain",
    category: "quick-game",
    title: "Word chain",
    prompt: "Say a word, then your partner says one starting with your last letter. Keep it going until {station}.",
    minSeconds: 45,
    rare: false,
    weight: 2,
  },
  {
    id: "quick-game-this-or-that",
    category: "quick-game",
    title: "This or that",
    prompt: "Five fast picks each: Dunkin or coffee shop, Sox or Celtics, beach or city, bus or train, sunrise or sunset.",
    minSeconds: 45,
    rare: false,
    weight: 2,
  },
  {
    id: "quick-game-twenty-questions",
    category: "quick-game",
    title: "Ten questions",
    prompt: "Think of a Boston landmark. Your partner gets ten yes-or-no questions to find it.",
    minSeconds: 90,
    rare: false,
    weight: 2,
  },
  {
    id: "late-bonus-delay-haiku",
    category: "late-bonus",
    title: "Delay haiku",
    prompt: "The train is late. Write a three-line haiku about it together, one line each and one shared.",
    minSeconds: 60,
    rare: true,
    weight: 3,
  },
  {
    id: "late-bonus-hidden-talent",
    category: "late-bonus",
    title: "Hidden talent",
    prompt: "Delay bonus: each of you shows one small hidden talent that fits in a train seat.",
    minSeconds: 60,
    rare: true,
    weight: 2,
  },
  {
    id: "late-bonus-rename-delay",
    category: "late-bonus",
    title: "Name the delay",
    prompt: "Give this delay a name like a storm. Then write its one-line weather report.",
    minSeconds: 45,
    rare: true,
    weight: 2,
  },
  {
    id: "late-bonus-best-stop",
    category: "late-bonus",
    title: "Best stop debate",
    prompt: "Delay bonus: each of you makes a thirty-second case for the best stop on the {line} Line.",
    minSeconds: 75,
    rare: true,
    weight: 2,
  },
  {
    id: "late-bonus-time-capsule",
    category: "late-bonus",
    title: "Time capsule",
    prompt: "Pick three things from this car to put in a time capsule about riding the T today.",
    minSeconds: 60,
    rare: true,
    weight: 2,
  },
];

export function templateById(id: string): MissionTemplate | undefined {
  return DECK.find((t) => t.id === id);
}
