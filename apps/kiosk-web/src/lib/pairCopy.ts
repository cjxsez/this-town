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

/**
 * Idle "How it works" steps. Mission mode keeps the three-tap mission + stamp line;
 * games-only says they meet here and play on phones or glasses.
 */
export function howItWorksSteps(gamesOnly: boolean): readonly [string, string, string] {
  if (gamesOnly) {
    return [
      "Tap the kiosk tag with your phone when you board.",
      "Get matched with a rider who shares your interests.",
      "Meet at the kiosk, then play on your phones or glasses.",
    ];
  }
  return [
    "Tap the kiosk tag with your phone when you board.",
    "Get matched with a rider who shares your interests.",
    "Meet at the kiosk, do the mission, both tap for a stamp.",
  ];
}
