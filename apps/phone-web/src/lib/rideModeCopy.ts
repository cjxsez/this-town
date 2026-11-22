/**
 * Ride Mode consent and riding copy that depends on the worker's gamesOnly flag.
 * Mission-mode strings match the previous hardcoded lines; games-only describes the
 * two-player games and that Ride Mode stays on until you turn it off or the trip ends.
 */

export function destinationHint(gamesOnly: boolean): string {
  if (gamesOnly) {
    return "Ride Mode stays on until you turn it off or the trip ends. You'll meet at a kiosk and play together on your phones or glasses.";
  }
  return "Ride Mode turns off at your stop, and missions always end before a stop, so you never miss it.";
}

export function rideModeMissionRule(gamesOnly: boolean): string {
  if (gamesOnly) {
    return "You meet at a kiosk and play short games together on your phones or glasses.";
  }
  return "You meet at a kiosk, play a short mission, and both tap the tag for a stamp. Missions end before your stop.";
}

export function rideModeEndsRule(destName: string, gamesOnly: boolean): string {
  if (gamesOnly) {
    return "Ride Mode stays on until you turn it off or the trip ends.";
  }
  return `Ride Mode turns off by itself at ${destName}.`;
}

export function ridingStayOnHint(ridersOnTrain: number, destName: string, gamesOnly: boolean): string {
  const others =
    ridersOnTrain > 1 ? `${ridersOnTrain - 1} other riders on this train. ` : "";
  if (gamesOnly) {
    return `${others}Ride Mode stays on until you turn it off or the trip ends.`;
  }
  return `${others}Ride Mode turns off at ${destName}.`;
}
