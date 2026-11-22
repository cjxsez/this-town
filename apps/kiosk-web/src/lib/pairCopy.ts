/**
 * Pair-screen body copy. Mission mode mentions the tag starting a mission; games-only
 * tells riders they find each other here and play on phones/glasses.
 */
export function pairIncomingBody(arrived: number, gamesOnly: boolean): string {
  if (gamesOnly) {
    return arrived > 0
      ? "Find each other here, then play on your phones or glasses."
      : "Meet here, then play on your phones or glasses.";
  }
  return arrived > 0 ? "One more tap on the tag starts your mission." : "Tap the tag when you're both here.";
}
