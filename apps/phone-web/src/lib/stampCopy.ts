/** Stamp detail activity line for a passport stamp's mission/template id. */
export function stampActivityLabel(missionId: string): { eyebrow: string; title: string } | null {
  if (missionId === "games-playlist") {
    return { eyebrow: "GAMES", title: "You played the three games together" };
  }
  return null;
}
