// Zod-free display labels for interest ids. Mirrors apps/phone-web/shared/catalog.ts INTERESTS.
// Used by the worker's "why you two" line.

export const INTEREST_LABELS: Record<string, string> = {
  ramen: "ramen",
  "red-sox": "the Red Sox",
  thrifting: "thrifting",
  running: "running",
  "live-music": "live music",
  coffee: "coffee",
  "board-games": "board games",
  museums: "museums",
  hiking: "hiking",
  anime: "anime",
  photography: "photography",
  cooking: "cooking",
  dumplings: "dumplings",
  baking: "baking",
  cannoli: "cannoli",
  celtics: "the Celtics",
  bruins: "the Bruins",
  soccer: "soccer",
  marathon: "the Marathon",
  theater: "theater",
  comics: "comics",
  film: "film",
  climbing: "climbing",
  cycling: "cycling",
  rowing: "rowing",
  chess: "chess",
  "video-games": "video games",
  trivia: "trivia",
  ai: "AI",
  hackathons: "hackathons",
  robotics: "robotics",
  history: "Boston history",
  bookstores: "bookstores",
  architecture: "architecture",
};

export const interestLabel = (id: string): string => INTEREST_LABELS[id] ?? id;

/** Same slug rule the phone uses to key stations ("Park Street" -> "park-st"). */
export function stopSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bstreet\b/g, "st")
    .replace(/\b(center|centre)\b/g, "ctr")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
